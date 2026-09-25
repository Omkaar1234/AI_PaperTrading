const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const net = require('net');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

// Import services
const predictionService = require('./services/predictionService');
const persistenceService = require('./src/services/persistenceService');
const marketDataService = require('./src/services/marketDataService');
const symbolSyncService = require('./src/services/symbolSyncService');
const { optionalAuth, requireAuth } = require('./src/auth/authMiddleware');
const {
    GOOGLE_SETUP_COOKIE_NAME,
    assertSessionConfigured,
    clearCookieOptions,
    clearSessionCookie,
    createUser,
    findGoogleUser,
    linkGoogleUser,
    loginWithPassword,
    publicUser,
    setSessionCookie,
    setupCookieOptions,
    signGoogleSetup,
    verifyToken
} = require('./src/auth/authService');
const { buildGoogleAuthUrl, exchangeCodeForProfile } = require('./src/auth/googleOAuth');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const PORT = process.env.BACKEND_PORT || 3001;
const ML_SERVICE_URL = `http://${process.env.ML_HOST || 'localhost'}:${process.env.ML_PORT || 5000}`;
const MATCHING_ENGINE_HOST = process.env.MATCHING_ENGINE_HOST || 'localhost';
const MATCHING_ENGINE_PORT = process.env.MATCHING_ENGINE_PORT || 9000;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(optionalAuth);

// In-memory storage for demo (use Redis/DB in production)
const trades = new Map();
const users = new Map();
const userOrders = new Map();

// Ensure default user exists
const DEFAULT_USER_ID = 'user_001';
const DEFAULT_WATCHLIST = [
    { symbol: 'RELIANCE.NS', assetType: 'stocks' },
    { symbol: 'TCS.NS', assetType: 'stocks' },
    { symbol: 'INFY.NS', assetType: 'stocks' }
];

users.set(DEFAULT_USER_ID, {
    id: DEFAULT_USER_ID,
    balance: 100000.00,
    positions: new Map()
});
userOrders.set(DEFAULT_USER_ID, []);

// Matching Engine Client
class MatchingEngineClient {
    constructor() {
        this.client = null;
        this.connected = false;
        this.connecting = false;
        this.connectPromise = null;
        this.reconnectTimer = null;
        this.responseBuffer = '';
        this.outboundQueue = [];
        this.inflightQueue = [];
    }

    log(message, payload) {
        if (payload === undefined) {
            console.log(`[ME] ${message}`);
            return;
        }
        console.log(`[ME] ${message}`, payload);
    }

    connect() {
        if (this.connected) {
            return Promise.resolve();
        }
        if (this.connecting && this.connectPromise) {
            return this.connectPromise;
        }

        this.connecting = true;
        this.client = new net.Socket();
        this.client.setKeepAlive(true, 5000);
        this.client.setNoDelay(true);

        this.connectPromise = new Promise((resolve, reject) => {
            const handleConnectError = (error) => {
                this.client.removeListener('connect', handleConnect);
                reject(error);
            };

            const handleConnect = () => {
                this.client.removeListener('error', handleConnectError);
                this.connected = true;
                this.connecting = false;
                this.log(`Connected to matching engine at ${MATCHING_ENGINE_HOST}:${MATCHING_ENGINE_PORT}`);
                this.flushOutboundQueue();
                resolve();
            };

            this.client.once('error', handleConnectError);
            this.client.connect(MATCHING_ENGINE_PORT, MATCHING_ENGINE_HOST, handleConnect);
        });

        this.client.on('data', (data) => {
            this.responseBuffer += data.toString();
            const responses = this.responseBuffer.split('\n');
            this.responseBuffer = responses.pop() || '';
            responses.forEach(response => {
                if (response.trim()) {
                    this.handleResponse(response.trim());
                }
            });
        });

        this.client.on('close', () => {
            this.log('Connection closed');
            this.connected = false;
            this.connecting = false;
            this.connectPromise = null;
            this.rejectInflightRequests(new Error('Matching engine disconnected'));
            this.scheduleReconnect();
        });

        this.client.on('error', (err) => {
            this.log('Socket error', err.message);
            if (!this.connected) {
                this.connecting = false;
                this.connectPromise = null;
            }
        });

        return this.connectPromise;
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((error) => {
                this.log('Reconnect failed', error.message);
                this.scheduleReconnect();
            });
        }, 2000);
    }

    rejectInflightRequests(error) {
        while (this.inflightQueue.length > 0) {
            const pending = this.inflightQueue.shift();
            clearTimeout(pending.timeoutId);
            pending.reject(error);
        }
    }

    flushOutboundQueue() {
        while (this.connected && this.outboundQueue.length > 0) {
            const pending = this.outboundQueue.shift();
            this.dispatchRequest(pending);
        }
    }

    dispatchRequest(pending) {
        this.inflightQueue.push(pending);
        this.log('TCP OUT', pending.message);
        this.client.write(`${pending.message}\n`);
    }

    async waitForConnection(timeoutMs = 2500) {
        if (this.connected) {
            return;
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Matching engine unavailable')), timeoutMs);
        });

        await Promise.race([this.connect(), timeoutPromise]);
    }

    sendRequest(command, params, options = {}) {
        return new Promise((resolve, reject) => {
            const message = `${command}|${params}`;
            const pending = {
                command,
                message,
                resolve,
                reject,
                timeoutId: setTimeout(() => {
                    const queuedIndex = this.outboundQueue.indexOf(pending);
                    if (queuedIndex >= 0) {
                        this.outboundQueue.splice(queuedIndex, 1);
                    }

                    const inflightIndex = this.inflightQueue.indexOf(pending);
                    if (inflightIndex >= 0) {
                        this.inflightQueue.splice(inflightIndex, 1);
                    }

                    reject(new Error(`Matching engine timeout for ${command}`));
                }, options.timeoutMs || 5000)
            };

            this.waitForConnection(options.connectionTimeoutMs || 2500)
                .then(() => {
                    if (this.connected) {
                        this.dispatchRequest(pending);
                    } else {
                        this.outboundQueue.push(pending);
                    }
                })
                .catch((error) => {
                    clearTimeout(pending.timeoutId);
                    reject(error);
                });
        });
    }

    handleResponse(response) {
        this.log('TCP IN', response);
        const pending = this.inflightQueue.shift();
        if (!pending) {
            this.log('Unmatched response', response);
            return;
        }

        clearTimeout(pending.timeoutId);
        pending.resolve(response);
    }
}

const matchingEngine = new MatchingEngineClient();
matchingEngine.connect().catch((error) => {
    console.error('Initial matching engine connection failed:', error.message);
    matchingEngine.scheduleReconnect();
});

function inferAssetType(symbol = '') {
    return symbol === 'DEFAULT' ? 'unknown' : marketDataService.inferAssetType(symbol);
}

function normalizeSymbolDocument(doc = {}) {
    return {
        symbol: doc.symbol,
        displaySymbol: doc.displaySymbol || doc.symbol,
        baseSymbol: doc.baseSymbol || doc.symbol,
        providerSymbol: doc.providerSymbol || doc.symbol,
        name: doc.name,
        exchange: doc.exchange,
        type: doc.type,
        assetType: doc.assetType,
        marketCapCategory: doc.marketCapCategory || 'unclassified',
        currency: doc.currency || null,
        sector: doc.sector || null,
        metadata: doc.metadata || {},
        lastSyncedAt: doc.lastSyncedAt
    };
}

function parseSymbolsParam(value = '') {
    return String(value)
        .split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
}

async function buildMarketPage(symbolDocs = []) {
    const normalizedDocs = symbolDocs.map(normalizeSymbolDocument);
    const quotes = await marketDataService.getQuotes(normalizedDocs.map((doc) => doc.symbol));
    const quoteMap = quotes.reduce((accumulator, quote) => {
        accumulator[quote.symbol] = quote;
        return accumulator;
    }, {});

    return normalizedDocs.map((doc) => {
        const quote = quoteMap[doc.symbol] || {};
        const previousClose = Number(quote.previousClose || 0);
        const changePercent = previousClose ? (Number(quote.change || 0) / previousClose) * 100 : 0;

        return {
            ...doc,
            price: Number(quote.price || 0),
            change: Number(quote.change || 0),
            changePercent: Number.isFinite(changePercent) ? changePercent : 0,
            volume: Number(quote.volume || 0),
            previousClose,
            quoteTimestamp: quote.timestamp || null
        };
    });
}

async function runSymbolSync() {
    try {
        const result = await symbolSyncService.syncAllSymbols();
        console.log('Symbol sync complete:', result);
        return result;
    } catch (error) {
        console.error('Symbol sync failed:', error.message);
        return null;
    }
}

function parseEngineResponse(response = '') {
    const parts = String(response || '').split('|');
    return {
        kind: parts[0] || '',
        parts,
        payload: parts.slice(1).join('|')
    };
}

function normalizeEngineTrade(trade = {}, { orderId, side }) {
    return {
        id: trade.trade_id,
        orderId,
        symbol: trade.symbol,
        price: Number(trade.price || 0),
        quantity: Number(trade.quantity || 0),
        buy_order_id: trade.buy_order_id || null,
        sell_order_id: trade.sell_order_id || null,
        buyer_id: trade.buyer_id || null,
        seller_id: trade.seller_id || null,
        side,
        timestamp: trade.timestamp || Date.now(),
        executedAt: trade.timestamp ? new Date(Number(trade.timestamp) / 1e6).toISOString() : new Date().toISOString(),
        counterpartyOrderId: side === 'BUY' ? trade.sell_order_id : trade.buy_order_id
    };
}

function projectTradeForUser(trade = {}, userId) {
    const isBuyer = trade.buyer_id === userId;
    const isSeller = trade.seller_id === userId;
    let side = trade.side || null;
    let orderId = trade.orderId || null;
    let counterpartyOrderId = trade.counterpartyOrderId || null;

    if (trade.side === 'BUY' && isSeller) {
        side = 'SELL';
        orderId = trade.counterpartyOrderId || trade.orderId || null;
        counterpartyOrderId = trade.orderId || null;
    } else if (trade.side === 'SELL' && isBuyer) {
        side = 'BUY';
        orderId = trade.counterpartyOrderId || trade.orderId || null;
        counterpartyOrderId = trade.orderId || null;
    } else if (!trade.side) {
        if (isBuyer) {
            side = 'BUY';
        } else if (isSeller) {
            side = 'SELL';
        }
    }

    return {
        id: trade.id || trade.tradeId,
        orderId,
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
        side,
        counterpartyOrderId,
        timestamp: trade.timestamp,
        executedAt: trade.executedAt
    };
}

async function submitOrderToExecutionVenue({ symbol, side, type, orderPrice, quantity, userId }) {
    const response = await matchingEngine.sendRequest(
        'PLACE_ORDER',
        `${symbol}|${side}|${type}|${orderPrice}|${quantity}|${userId}`
    );
    const parsed = parseEngineResponse(response);

    if (parsed.kind !== 'SUCCESS') {
        throw new Error(parsed.parts[1] || 'Matching engine rejected order');
    }

    let tradesFromEngine = [];
    if (parsed.parts[5]) {
        try {
            tradesFromEngine = JSON.parse(parsed.parts.slice(5).join('|'));
        } catch (error) {
            console.error('Failed to parse matching engine trades payload:', error.message);
        }
    }

    return {
        venue: 'cpp_matching_engine',
        orderId: parsed.parts[1],
        filledQty: Number.isNaN(parseInt(parsed.parts[2], 10)) ? 0 : parseInt(parsed.parts[2], 10),
        remainingQty: Number.isNaN(parseInt(parsed.parts[3], 10)) ? quantity : parseInt(parsed.parts[3], 10),
        avgFillPrice: tradesFromEngine.length > 0
            ? tradesFromEngine.reduce(
                (sum, trade) => sum + Number(trade.price || 0) * Number(trade.quantity || 0),
                0
            ) / Math.max(
                1,
                tradesFromEngine.reduce((sum, trade) => sum + Number(trade.quantity || 0), 0)
            )
            : (parseFloat(parsed.parts[4]) || 0),
        trades: tradesFromEngine.map((trade) => normalizeEngineTrade(trade, {
            orderId: parsed.parts[1],
            side
        }))
    };
}

function buildPositionsFromOrders(orders = []) {
    const positionMap = new Map();

    const sortedOrders = [...orders].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
        const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return timeA - timeB;
    });

    sortedOrders.forEach((order) => {
        const filledQty = Number(order.filled_qty || 0);
        if (!filledQty) {
            return;
        }

        const existing = positionMap.get(order.symbol) || {
            symbol: order.symbol,
            assetType: inferAssetType(order.symbol),
            quantity: 0,
            avgPrice: 0,
            invested: 0,
            realizedPnl: 0
        };

        const fillPrice = Number(order.avg_fill_price || order.price || 0);

        if (order.side === 'BUY') {
            existing.quantity += filledQty;
            existing.invested += filledQty * fillPrice;
            existing.avgPrice = existing.quantity > 0 ? existing.invested / existing.quantity : 0;
        } else if (order.side === 'SELL') {
            const costBasisDeducted = filledQty * (existing.avgPrice || 0);
            existing.quantity -= filledQty;
            existing.invested = Math.max(0, existing.invested - costBasisDeducted);
            existing.realizedPnl = (existing.realizedPnl || 0) + (filledQty * (fillPrice - (existing.avgPrice || 0)));
            if (existing.quantity <= 0) {
                existing.quantity = 0;
                existing.invested = 0;
                existing.avgPrice = 0;
            }
        }

        positionMap.set(order.symbol, existing);
    });

    return Array.from(positionMap.values()).filter((position) => position.quantity > 0);
}

function buildPositionsFromRuntimeUser(userId) {
    const user = users.get(userId);
    const orders = userOrders.get(userId) || [];
    const orderDerivedPositions = buildPositionsFromOrders(orders);
    const orderMap = new Map(orderDerivedPositions.map((position) => [position.symbol, position]));

    if (!user) {
        return orderDerivedPositions;
    }

    return Array.from(user.positions.entries())
        .map(([symbol, quantity]) => {
            const existing = orderMap.get(symbol);
            return {
                symbol,
                assetType: inferAssetType(symbol),
                quantity: Number(quantity || 0),
                avgPrice: existing?.avgPrice || 0,
                invested: Number(quantity || 0) * Number(existing?.avgPrice || 0),
                marketPrice: existing?.marketPrice || 0,
                marketValue: Number(quantity || 0) * Number(existing?.marketPrice || 0),
                unrealizedPnl: existing?.unrealizedPnl || 0
            };
        })
        .filter((position) => position.quantity !== 0);
}

async function syncUserSnapshot(userId) {
    const user = users.get(userId);
    if (!user) {
        return;
    }

    await persistenceService.saveUserState(user);

    const positions = buildPositionsFromRuntimeUser(userId);
    await persistenceService.replacePositions(userId, positions);
}

function findOrderOwner(orderId) {
    for (const [userId, orders] of userOrders.entries()) {
        const order = orders.find((item) => item.id === orderId);
        if (order) {
            return { userId, order };
        }
    }
    return null;
}

async function ensureRuntimeUser(userId) {
    if (users.has(userId)) {
        return users.get(userId);
    }

    const persistedUser = await persistenceService.getUser(userId);
    if (persistedUser) {
        users.set(userId, persistedUser);
        return persistedUser;
    }

    return null;
}

function updateOrderFillState(order, tradePrice, tradeQty) {
    const nextFilledQty = Number(order.filled_qty || 0) + Number(tradeQty || 0);
    const nextRemainingQty = Math.max(0, Number(order.quantity || 0) - nextFilledQty);
    const previousFilledQty = Number(order.filled_qty || 0);
    const previousAvgFill = Number(order.avg_fill_price || 0);
    const nextNotional = previousFilledQty * previousAvgFill + Number(tradePrice || 0) * Number(tradeQty || 0);

    order.filled_qty = nextFilledQty;
    order.remaining_qty = nextRemainingQty;
    order.avg_fill_price = nextFilledQty > 0 ? nextNotional / nextFilledQty : 0;
    order.status = nextRemainingQty === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
}

async function reconcileCounterpartyTrade(trade, currentOrderSide, currentUserId) {
    const counterpartyOrderId = currentOrderSide === 'BUY' ? trade.sell_order_id : trade.buy_order_id;
    const counterpartyUserId = currentOrderSide === 'BUY' ? trade.seller_id : trade.buyer_id;
    const counterpartySide = currentOrderSide === 'BUY' ? 'SELL' : 'BUY';

    if (!counterpartyOrderId || !counterpartyUserId || counterpartyUserId === currentUserId) {
        return;
    }

    let owner = findOrderOwner(counterpartyOrderId);
    if (!owner) {
        const persistedOrder = await persistenceService.getOrderById(counterpartyOrderId);
        if (persistedOrder) {
            owner = {
                userId: persistedOrder.userId,
                order: {
                    id: persistedOrder.orderId,
                    symbol: persistedOrder.symbol,
                    side: persistedOrder.side,
                    type: persistedOrder.orderType,
                    price: persistedOrder.price,
                    quantity: persistedOrder.quantity,
                    filled_qty: persistedOrder.filled_qty,
                    remaining_qty: persistedOrder.remaining_qty,
                    avg_fill_price: persistedOrder.avg_fill_price,
                    user_id: persistedOrder.userId,
                    status: persistedOrder.status,
                    timestamp: persistedOrder.timestamp || persistedOrder.createdAt
                }
            };
            if (!userOrders.has(owner.userId)) {
                userOrders.set(owner.userId, []);
            }
            userOrders.get(owner.userId).push(owner.order);
        }
    }

    if (!owner) {
        return;
    }

    const counterpartyUser = await ensureRuntimeUser(owner.userId);
    if (!counterpartyUser) {
        return;
    }

    updateOrderFillState(owner.order, trade.price, trade.quantity);

    if (counterpartySide === 'SELL') {
        const currentPos = Number(counterpartyUser.positions.get(trade.symbol) || 0);
        counterpartyUser.positions.set(trade.symbol, currentPos - Number(trade.quantity || 0));
        counterpartyUser.balance += Number(trade.price || 0) * Number(trade.quantity || 0);
    } else {
        const currentPos = Number(counterpartyUser.positions.get(trade.symbol) || 0);
        counterpartyUser.positions.set(trade.symbol, currentPos + Number(trade.quantity || 0));
        counterpartyUser.balance -= Number(trade.price || 0) * Number(trade.quantity || 0);
    }

    await persistenceService.saveOrder(owner.order, {
        userId: owner.userId,
        symbol: owner.order.symbol,
        assetType: inferAssetType(owner.order.symbol),
        orderType: owner.order.type,
        engineOrderRef: owner.order.id,
        source: 'cpp_matching_engine'
    });

    await persistenceService.createNotification({
        userId: owner.userId,
        title: 'Order Executed',
        message: `Your resting ${counterpartySide} order executed: ${trade.quantity} shares of ${trade.symbol} at ₹${Number(trade.price).toFixed(2)}`,
        type: 'SUCCESS',
        metadata: { tradeId: trade.id, orderId: owner.order.id, symbol: trade.symbol, side: counterpartySide }
    });

    await syncUserSnapshot(owner.userId);
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'backend-api',
        matching_engine: matchingEngine.connected ? 'connected' : 'disconnected',
        database: persistenceService.isEnabled() ? 'connected' : 'disabled'
    });
});

// ===================== AUTH ROUTES =====================

app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({ user: req.user });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        assertSessionConfigured();
        const { name, age, email, password, confirmPassword, initialBalance } = req.body || {};

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const user = await createUser({
            name,
            age,
            email,
            password,
            initialBalance,
            authProvider: 'local'
        });

        users.set(user.userId, {
            id: user.userId,
            name: user.name,
            email: user.email,
            balance: user.wallet?.cashBalance ?? user.currentBalance ?? 0,
            currency: user.wallet?.currency || 'INR',
            positions: new Map()
        });
        userOrders.set(user.userId, []);
        const token = setSessionCookie(res, user);

        res.status(201).json({ user: publicUser(user), token });
    } catch (error) {
        const statusCode = error.statusCode || (error.code === 11000 ? 409 : 500);
        res.status(statusCode).json({
            error: error.code === 11000 ? 'An account with this email already exists' : error.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        assertSessionConfigured();
        const user = await loginWithPassword(req.body || {});
        const hydratedUser = await persistenceService.getUser(user.userId);
        users.set(user.userId, hydratedUser || {
            id: user.userId,
            name: user.name,
            email: user.email,
            balance: user.wallet?.cashBalance ?? user.currentBalance ?? 0,
            currency: user.wallet?.currency || 'INR',
            positions: new Map()
        });
        const token = setSessionCookie(res, user);
        res.json({ user: publicUser(user), token });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.clearCookie(GOOGLE_SETUP_COOKIE_NAME, clearCookieOptions());
    res.json({ success: true });
});

app.get('/api/auth/google/start', (req, res) => {
    try {
        assertSessionConfigured();
        const state = crypto.randomBytes(24).toString('hex');
        res.cookie('ptx_google_state', state, setupCookieOptions());
        res.redirect(buildGoogleAuthUrl(state));
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.get('/api/auth/google/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
        assertSessionConfigured();
        if (!req.query.code || !req.query.state || req.query.state !== req.cookies?.ptx_google_state) {
            return res.redirect(`${frontendUrl}/login?error=google_state`);
        }

        const profile = await exchangeCodeForProfile(req.query.code);
        const existingUser = await findGoogleUser(profile);

        if (existingUser) {
            await linkGoogleUser(existingUser, profile.googleId);
            const hydratedUser = await persistenceService.getUser(existingUser.userId);
            users.set(existingUser.userId, hydratedUser || {
                id: existingUser.userId,
                name: existingUser.name,
                email: existingUser.email,
                balance: existingUser.wallet?.cashBalance ?? existingUser.currentBalance ?? 0,
                currency: existingUser.wallet?.currency || 'INR',
                positions: new Map()
            });
            setSessionCookie(res, existingUser);
            res.clearCookie('ptx_google_state', clearCookieOptions());
            return res.redirect(`${frontendUrl}/dashboard`);
        }

        const setupToken = signGoogleSetup(profile);
        res.cookie(GOOGLE_SETUP_COOKIE_NAME, setupToken, setupCookieOptions());
        res.clearCookie('ptx_google_state', clearCookieOptions());
        return res.redirect(`${frontendUrl}/google-setup`);
    } catch (error) {
        console.error('Google auth error:', error.message);
        return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
});

app.get('/api/auth/google/setup', async (req, res) => {
    try {
        const token = req.cookies?.[GOOGLE_SETUP_COOKIE_NAME];
        if (!token) {
            return res.status(401).json({ error: 'Google setup session expired' });
        }
        const profile = verifyToken(token);
        res.json({
            profile: {
                name: profile.name,
                email: profile.email
            }
        });
    } catch (error) {
        res.status(401).json({ error: 'Google setup session expired' });
    }
});

app.post('/api/auth/google/setup', async (req, res) => {
    try {
        assertSessionConfigured();
        const token = req.cookies?.[GOOGLE_SETUP_COOKIE_NAME];
        if (!token) {
            return res.status(401).json({ error: 'Google setup session expired' });
        }
        const profile = verifyToken(token);
        const user = await createUser({
            name: req.body.name || profile.name,
            age: req.body.age,
            email: profile.email,
            initialBalance: req.body.initialBalance,
            authProvider: 'google',
            googleId: profile.googleId
        });

        users.set(user.userId, {
            id: user.userId,
            name: user.name,
            email: user.email,
            balance: user.wallet?.cashBalance ?? user.currentBalance ?? 0,
            currency: user.wallet?.currency || 'INR',
            positions: new Map()
        });
        userOrders.set(user.userId, []);
        res.clearCookie(GOOGLE_SETUP_COOKIE_NAME, clearCookieOptions());
        setSessionCookie(res, user);
        res.status(201).json({ user: publicUser(user) });
    } catch (error) {
        const statusCode = error.statusCode || (error.code === 11000 ? 409 : 500);
        res.status(statusCode).json({
            error: error.code === 11000 ? 'An account with this email already exists' : error.message
        });
    }
});

// ===================== NEW API ENDPOINTS =====================

// POST /predict and /api/predict - Prediction endpoint
app.post(['/predict', '/api/predict'], requireAuth, async (req, res) => {
    try {
        const { symbol } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        const prediction = await predictionService.getPrediction(symbol);

        res.json(prediction);
    } catch (error) {
        console.error('Prediction error:', error.message);
        res.status(500).json({ error: 'Failed to get prediction' });
    }
});

// POST /suggest - Get trading suggestion
app.post('/suggest', requireAuth, async (req, res) => {
    try {
        const { symbol, prediction, currentPosition = 0 } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        const suggestion = await predictionService.getSuggestion(
            symbol,
            prediction,
            currentPosition
        );

        res.json({
            action: suggestion.action
        });
    } catch (error) {
        console.error('Suggestion error:', error.message);
        res.status(500).json({ error: 'Failed to get suggestion' });
    }
});

// POST /order - Place a simple order
app.post('/order', async (req, res) => {
    res.status(410).json({
        error: 'Legacy /order endpoint removed. Use POST /api/orders with symbol, side, type, price, quantity.'
    });
});

// GET /orderbook - Return current buy and sell orders
app.get('/orderbook', (req, res) => {
    res.status(410).json({
        error: 'Legacy /orderbook endpoint removed. Use GET /api/orderbook/:symbol.'
    });
});

// GET /trades - Return executed trades
app.get('/trades', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const persistedTrades = await persistenceService.getRecentTrades(limit);
        const recent = persistedTrades.length > 0
            ? persistedTrades.map((trade) => ({
                id: trade.tradeId,
                orderId: trade.orderId,
                symbol: trade.symbol,
                price: trade.price,
                quantity: trade.quantity,
                buyer_id: trade.buyer_id,
                seller_id: trade.seller_id,
                timestamp: trade.timestamp,
                executedAt: trade.executedAt
            }))
            : Array.from(trades.values())
                .sort((left, right) => new Date(right.executedAt || right.timestamp).getTime() - new Date(left.executedAt || left.timestamp).getTime())
                .slice(0, limit);

        res.json({
            trades: recent,
            count: recent.length
        });
    } catch (error) {
        console.error('Trades error:', error.message);
        res.status(500).json({ error: 'Failed to get trades' });
    }
});

// GET /orderbook/stats - Return order book statistics
app.get('/orderbook/stats', (req, res) => {
    res.status(410).json({
        error: 'Legacy /orderbook/stats endpoint removed. Use GET /api/orderbook/:symbol for live depth.'
    });
});

// ===================== PREDICTION ROUTES =====================

// Get stock prediction
app.post('/api/predict', requireAuth, async (req, res) => {
    try {
        const { symbol, model_type = 'lstm', days = 60 } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        // Forward to ML service
        const response = await axios.post(`${ML_SERVICE_URL}/api/predict`, {
            symbol,
            model_type,
            days
        });

        res.json(response.data);
    } catch (error) {
        console.error('Prediction error:', error.message);
        res.status(500).json({
            error: 'Failed to get prediction',
            details: error.response?.data?.error || error.message
        });
    }
});

// Get ML V2.1 5-trading-day asset price movement prediction
app.post('/api/v2/predict', requireAuth, async (req, res) => {
    try {
        const { symbol, assetType = 'stocks' } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        const prediction = await predictionService.getPredictionV2(symbol, { assetType });
        res.json(prediction);
    } catch (error) {
        console.error('ML V2 prediction error:', error.message);
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Failed to get V2 prediction',
            details: error.response?.data?.error || error.message
        });
    }
});

// Get investment suggestion
app.post('/api/suggest', requireAuth, async (req, res) => {
    try {
        const { symbol, prediction } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        let predData = prediction;

        // If no prediction provided, get one first
        if (!prediction) {
            const predResponse = await axios.post(`${ML_SERVICE_URL}/api/predict`, {
                symbol,
                model_type: 'lstm'
            });
            predData = predResponse.data;
        }

        // Get suggestion from ML service
        const response = await axios.post(`${ML_SERVICE_URL}/api/suggest`, {
            symbol,
            prediction: predData
        });

        res.json(response.data);
    } catch (error) {
        console.error('Suggestion error:', error.message);
        res.status(500).json({
            error: 'Failed to get suggestion',
            details: error.message
        });
    }
});

// Get historical data
app.get('/api/data/:symbol', async (req, res) => {
    try {
        const symbol = String(req.params.symbol || '').trim().toUpperCase();
        const days = Math.max(1, Number(req.query.days || 30));

        try {
            const response = await axios.get(
                `${ML_SERVICE_URL}/api/data/${symbol}?days=${days}`,
                { timeout: 8000 }
            );

            const rows = Array.isArray(response.data?.data)
                ? response.data.data
                : Array.isArray(response.data?.candles)
                    ? response.data.candles
                    : [];

            return res.json({
                symbol,
                source: 'ml-service',
                data: rows
            });
        } catch (error) {
            console.error('ML historical data fetch failed:', error.message);
        }

        const range = days <= 1 ? '1d' : days <= 5 ? '5d' : days <= 30 ? '1mo' : '3mo';
        const candlesPayload = await marketDataService.getCandles(symbol, inferAssetType(symbol), '1d', range);
        res.json({
            symbol,
            source: 'market-data-service',
            data: candlesPayload.candles || [],
            ...(candlesPayload.error ? { error: candlesPayload.error } : {})
        });
    } catch (error) {
        console.error('Data fetch error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch historical data',
            details: error.message
        });
    }
});

// ===================== MARKET DATA ROUTES =====================

app.get('/api/symbols', async (req, res) => {
    try {
        const symbols = parseSymbolsParam(req.query.symbols || '');
        const result = await persistenceService.findSymbols({
            q: req.query.q,
            page: req.query.page,
            limit: req.query.limit || (symbols.length ? symbols.length : 50),
            type: req.query.type,
            exchange: req.query.exchange,
            marketCapCategory: req.query.marketCapCategory,
            symbols
        });

        res.json({
            symbols: result.symbols.map(normalizeSymbolDocument),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Symbols fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch symbols' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        if (!query) {
            return res.json({ symbols: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false } });
        }

        const result = await persistenceService.findSymbols({
            q: query,
            page: req.query.page,
            limit: req.query.limit || 10,
            type: req.query.type,
            exchange: req.query.exchange
        });

        res.json({
            query,
            symbols: result.symbols.map(normalizeSymbolDocument),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: 'Failed to search symbols' });
    }
});

app.get('/api/market', async (req, res) => {
    try {
        const result = await persistenceService.findSymbols({
            q: req.query.q,
            page: req.query.page,
            limit: req.query.limit || 25,
            type: req.query.type,
            exchange: req.query.exchange,
            marketCapCategory: req.query.marketCapCategory
        });

        const market = await buildMarketPage(result.symbols);

        res.json({
            market,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Market list error:', error.message);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

app.post('/api/symbols/sync', async (req, res) => {
    try {
        const result = await runSymbolSync();
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync symbols' });
    }
});

app.get('/api/market/quote/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const assetType = req.query.assetType || inferAssetType(symbol);
        console.log('Fetching symbol:', symbol.toUpperCase());
        const quote = await marketDataService.getQuote(symbol.toUpperCase(), assetType);
        res.json(quote);
    } catch (error) {
        console.error('Quote fetch error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/market/quotes', async (req, res) => {
    try {
        const symbols = (req.query.symbols || '')
            .split(',')
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean);
        const assetType = req.query.assetType || null;
        const quotes = await marketDataService.getQuotes(symbols, assetType);
        res.json({ quotes });
    } catch (error) {
        console.error('Quotes fetch error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/market/candles/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const assetType = req.query.assetType || inferAssetType(symbol);
        const interval = req.query.interval || '5m';
        const range = req.query.range || '1d';
        console.log('Fetching symbol:', symbol.toUpperCase());
        const candles = await marketDataService.getCandles(symbol.toUpperCase(), assetType, interval, range);
        res.json(candles);
    } catch (error) {
        console.error('Candle fetch error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ===================== TRADING ROUTES =====================

// Place an order
app.post('/api/orders', requireAuth, async (req, res) => {
    try {
        const symbol = String(req.body.symbol || '').trim().toUpperCase();
        const side = String(req.body.side || '').trim().toUpperCase();
        const type = String(req.body.type || 'LIMIT').trim().toUpperCase();
        const quantity = Number(req.body.quantity);
        const user_id = req.user.id;
        const requestPrice = req.body.price === undefined || req.body.price === null ? null : Number(req.body.price);

        if (!symbol || !side || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields: symbol, side, quantity'
            });
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive integer' });
        }

        if (side !== 'BUY' && side !== 'SELL') {
            return res.status(400).json({ error: 'Side must be BUY or SELL' });
        }

        if (type !== 'LIMIT' && type !== 'MARKET') {
            return res.status(400).json({ error: 'Type must be LIMIT or MARKET' });
        }

        if (type === 'LIMIT' && (!Number.isFinite(requestPrice) || requestPrice <= 0)) {
            return res.status(400).json({ error: 'Price required for LIMIT orders' });
        }

        const assetType = inferAssetType(symbol);
        const quote = await marketDataService.getQuote(symbol, assetType);
        if (quote?.error && !Number(quote.price || 0)) {
            return res.status(400).json({
                error: 'Invalid symbol or no market data available',
                symbol
            });
        }

        let orderPrice = requestPrice;
        if (type === 'MARKET') {
            orderPrice = Number(quote.price || 0);
            if (!orderPrice) {
                return res.status(400).json({ error: 'Could not get market price' });
            }
        }

        // Check user balance for buy orders
        if (!users.has(user_id)) {
            const persistedUser = await persistenceService.getUser(user_id);
            if (persistedUser) {
                users.set(user_id, persistedUser);
            }
        }

        const user = users.get(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (side === 'BUY') {
            const openBuyOrders = (userOrders.get(user_id) || []).filter(
                (o) => o.side === 'BUY' && ['OPEN', 'PARTIALLY_FILLED'].includes(o.status)
            );
            const reservedCash = openBuyOrders.reduce(
                (sum, o) => sum + Number(o.price || 0) * Number(o.remaining_qty || 0),
                0
            );
            const availableCash = Math.max(0, user.balance - reservedCash);
            const requiredFunds = orderPrice * quantity;
            if (availableCash < requiredFunds) {
                return res.status(400).json({
                    error: 'Insufficient funds: Available buying power exceeded by open orders',
                    required: requiredFunds,
                    available: availableCash,
                    cashBalance: user.balance,
                    reservedCash
                });
            }
        }
        else {
            const position = user.positions.get(symbol) || 0;
            if (position < quantity) {
                return res.status(400).json({
                    error: 'Insufficient position',
                    required: quantity,
                    available: position
                });
            }
        }

        const executionResult = await submitOrderToExecutionVenue({
            symbol,
            side,
            type,
            orderPrice,
            quantity,
            userId: user_id
        });
        const orderId = executionResult.orderId;
        const filledQty = Number(executionResult.filledQty || 0);
        const remainingQty = Number(executionResult.remainingQty || 0);
        const avgFillPrice = Number(executionResult.avgFillPrice || 0);

        // EMPTY BOOK MARKET ORDER HANDLING:
        if (type === 'MARKET' && filledQty === 0) {
            const cancelledOrder = {
                id: orderId,
                symbol,
                side,
                type,
                price: orderPrice,
                quantity,
                filled_qty: 0,
                remaining_qty: 0,
                avg_fill_price: 0,
                user_id,
                status: 'CANCELLED',
                timestamp: new Date().toISOString()
            };

            if (!userOrders.has(user_id)) {
                userOrders.set(user_id, []);
            }
            userOrders.get(user_id).push(cancelledOrder);

            await persistenceService.saveOrder(cancelledOrder, {
                userId: user_id,
                symbol,
                assetType,
                orderType: type,
                engineOrderRef: orderId,
                submittedAt: new Date(),
                source: executionResult.venue
            });

            await persistenceService.createNotification({
                userId: user_id,
                title: 'Order Cancelled',
                message: `Market ${side} order for ${quantity} ${symbol} cancelled: No counterparty liquidity available in the order book.`,
                type: 'WARNING',
                metadata: { orderId, symbol, side, quantity }
            });

            await syncUserSnapshot(user_id);

            return res.json({
                success: false,
                message: 'Market order cancelled: No counterparty liquidity available in the order book.',
                order: cancelledOrder,
                trades: [],
                executionVenue: executionResult.venue,
                user: {
                    balance: user.balance,
                    positions: Object.fromEntries(user.positions)
                }
            });
        }

        const executionStatus = filledQty === quantity
            ? 'FILLED'
            : filledQty > 0
                ? 'PARTIALLY_FILLED'
                : (type === 'MARKET' ? 'CANCELLED' : 'OPEN');

        if (side === 'BUY') {
            const totalCost = executionResult.trades.reduce(
                (sum, trade) => sum + Number(trade.price || 0) * Number(trade.quantity || 0),
                0
            );
            user.balance -= totalCost;

            if (filledQty > 0) {
                const currentPos = user.positions.get(symbol) || 0;
                user.positions.set(symbol, currentPos + filledQty);
            }
            // Resting limit order remainder does NOT prematurely deduct cash
        } else if (filledQty > 0) {
            const currentPos = user.positions.get(symbol) || 0;
            user.positions.set(symbol, currentPos - filledQty);
            const proceeds = executionResult.trades.reduce(
                (sum, trade) => sum + Number(trade.price || 0) * Number(trade.quantity || 0),
                0
            );
            user.balance += proceeds;
        }

        const order = {
            id: orderId,
            symbol,
            side,
            type,
            price: orderPrice,
            quantity,
            filled_qty: filledQty,
            remaining_qty: remainingQty,
            avg_fill_price: avgFillPrice,
            user_id,
            status: executionStatus,
            timestamp: new Date().toISOString()
        };

        if (!userOrders.has(user_id)) {
            userOrders.set(user_id, []);
        }
        userOrders.get(user_id).push(order);

        await persistenceService.saveOrder(order, {
            userId: user_id,
            symbol,
            assetType,
            orderType: type,
            engineOrderRef: orderId,
            submittedAt: new Date(),
            source: executionResult.venue
        });

        if (executionResult.trades.length > 0) {
            for (const executedTrade of executionResult.trades) {
                trades.set(executedTrade.id, executedTrade);
                await persistenceService.saveTrade(executedTrade, {
                    userId: user_id,
                    orderId,
                    assetType,
                    side
                });
                await reconcileCounterpartyTrade(executedTrade, side, user_id);
            }
        }

        if (filledQty > 0) {
            await persistenceService.createNotification({
                userId: user_id,
                title: executionStatus === 'FILLED' ? 'Order Executed' : 'Order Partially Executed',
                message: `${side} ${filledQty}/${quantity} ${symbol} @ ₹${avgFillPrice.toFixed(2)}`,
                type: 'SUCCESS',
                metadata: { orderId, symbol, side, filledQty, avgFillPrice }
            });
        } else if (executionStatus === 'OPEN') {
            await persistenceService.createNotification({
                userId: user_id,
                title: 'Order Placed',
                message: `Resting LIMIT ${side} order placed for ${quantity} ${symbol} @ ₹${orderPrice.toFixed(2)}`,
                type: 'INFO',
                metadata: { orderId, symbol, side, quantity, price: orderPrice }
            });
        }

        await syncUserSnapshot(user_id);

        res.json({
            success: true,
            order,
            trades: executionResult.trades,
            executionVenue: executionResult.venue,
            user: {
                balance: user.balance,
                positions: Object.fromEntries(user.positions)
            }
        });
    } catch (error) {
        console.error('Order placement error:', error);
        const statusCode = error.message.includes('Matching engine') ? 503 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

// Cancel an order
app.post('/api/orders/:orderId/cancel', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const authenticatedUserId = req.user.id;
        let foundUserId = null;
        let targetOrder = null;

        const runtimeOrders = userOrders.get(authenticatedUserId) || [];
        targetOrder = runtimeOrders.find((item) => item.id === orderId);
        foundUserId = targetOrder ? authenticatedUserId : null;

        if (!targetOrder) {
            const persistedOrder = await persistenceService.getOrderById(orderId);
            if (persistedOrder) {
                if (persistedOrder.userId !== authenticatedUserId) {
                    return res.status(403).json({ error: 'Forbidden resource' });
                }

                foundUserId = authenticatedUserId;
                targetOrder = {
                    id: persistedOrder.orderId,
                    symbol: persistedOrder.symbol,
                    side: persistedOrder.side,
                    type: persistedOrder.orderType,
                    price: persistedOrder.price,
                    quantity: persistedOrder.quantity,
                    filled_qty: persistedOrder.filled_qty,
                    remaining_qty: persistedOrder.remaining_qty,
                    avg_fill_price: persistedOrder.avg_fill_price,
                    user_id: persistedOrder.userId,
                    status: persistedOrder.status,
                    timestamp: persistedOrder.timestamp || persistedOrder.createdAt
                };
            }
        }

        const symbol = String(req.body.symbol || targetOrder?.symbol || '').trim().toUpperCase();
        if (!symbol || !targetOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const response = await matchingEngine.sendRequest(
            'CANCEL_ORDER',
            `${symbol}|${orderId}`
        );
        const parsed = parseEngineResponse(response);

        if (parsed.kind === 'SUCCESS') {
            targetOrder.status = 'CANCELLED';
            targetOrder.remaining_qty = 0;

            await persistenceService.saveOrder(targetOrder, {
                userId: foundUserId,
                symbol: targetOrder.symbol || symbol,
                assetType: inferAssetType(targetOrder.symbol || symbol),
                orderType: targetOrder.type || 'LIMIT',
                engineOrderRef: orderId
            });

            if (foundUserId) {
                await persistenceService.createNotification({
                    userId: foundUserId,
                    title: 'Order Cancelled',
                    message: `Order ${orderId} for ${symbol} was cancelled.`,
                    type: 'INFO',
                    metadata: { orderId, symbol }
                });
                await syncUserSnapshot(foundUserId);
            }
        } else {
            return res.status(400).json({
                success: false,
                error: parsed.parts[1] || 'Failed to cancel order'
            });
        }

        res.json({
            success: true,
            message: parsed.parts[1] || response,
            order: targetOrder
        });
    } catch (error) {
        const statusCode = error.message.includes('Matching engine') ? 503 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

// Get order book
app.get('/api/orderbook/:symbol', async (req, res) => {
    try {
        const symbol = String(req.params.symbol || '').trim().toUpperCase();
        const response = await matchingEngine.sendRequest('GET_BOOK', symbol);
        const parsed = parseEngineResponse(response);

        if (parsed.kind === 'BOOK' && parsed.payload) {
            const bookData = JSON.parse(parsed.payload);
            res.json({
                symbol,
                ...bookData
            });
        } else {
            res.json({
                symbol,
                bids: [],
                asks: []
            });
        }
    } catch (error) {
        console.error('Order book error:', error);
        // Return empty book on error
        res.json({
            symbol: req.params.symbol.toUpperCase(),
            bids: [],
            asks: [],
            error: error.message
        });
    }
});

// Get user's orders
app.get('/api/users/:userId/orders', requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden resource' });
    }
    const persistedOrders = await persistenceService.getOrdersByUser(userId);
    const orders = persistedOrders.length > 0
        ? persistedOrders.map((order) => ({
            id: order.orderId,
            symbol: order.symbol,
            side: order.side,
            type: order.orderType,
            price: order.price,
            quantity: order.quantity,
            filled_qty: order.filled_qty,
            remaining_qty: order.remaining_qty,
            avg_fill_price: order.avg_fill_price,
            user_id: order.userId,
            status: order.status,
            timestamp: order.timestamp || order.createdAt
        }))
        : (userOrders.get(userId) || []);
    res.json({ orders });
});

// Get user's trades
app.get('/api/users/:userId/trades', requireAuth, async (req, res) => {
    if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden resource' });
    }
    const persistedTrades = await persistenceService.getTradesByUser(req.params.userId);
    const userTrades = persistedTrades.length > 0
        ? persistedTrades.map((trade) => projectTradeForUser({
            id: trade.tradeId,
            orderId: trade.orderId,
            symbol: trade.symbol,
            price: trade.price,
            quantity: trade.quantity,
            buyer_id: trade.buyer_id,
            seller_id: trade.seller_id,
            side: trade.side,
            counterpartyOrderId: trade.counterpartyOrderId,
            timestamp: trade.timestamp,
            executedAt: trade.executedAt
        }, req.params.userId))
        : Array.from(trades.values()).filter(
            (trade) => trade.buyer_id === req.params.userId || trade.seller_id === req.params.userId
        ).map((trade) => projectTradeForUser(trade, req.params.userId));
    res.json({ trades: userTrades });
});

// Get user info
app.get('/api/users/:userId', requireAuth, async (req, res) => {
    if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden resource' });
    }
    const persistedUser = await persistenceService.getUser(req.params.userId);
    const user = persistedUser || users.get(req.params.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        balance: user.balance,
        positions: Object.fromEntries(user.positions)
    });
});

// Create user
app.post('/api/users', requireAuth, async (req, res) => {
    res.status(410).json({
        error: 'Legacy user creation is disabled. Use POST /api/auth/register.'
    });
});

// Get order history
app.get('/api/orders/:userId/history', requireAuth, async (req, res) => {
    try {
        if (req.params.userId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        const limit = parseInt(req.query.limit, 10) || 200;
        const orders = await persistenceService.getOrdersByUser(req.params.userId, limit);

        if (orders.length === 0) {
            return res.json({ orders: userOrders.get(req.params.userId) || [] });
        }

        res.json({
            orders: orders.map((order) => ({
                id: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.orderType,
                price: order.price,
                quantity: order.quantity,
                filled_qty: order.filled_qty,
                remaining_qty: order.remaining_qty,
                avg_fill_price: order.avg_fill_price,
                status: order.status,
                user_id: order.userId,
                timestamp: order.timestamp || order.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single order
app.get('/api/orders/:orderId', requireAuth, async (req, res) => {
    try {
        const runtimeOrder = Array.from(userOrders.values())
            .flat()
            .find((order) => order.id === req.params.orderId);
        const persistedOrder = await persistenceService.getOrderById(req.params.orderId);

        const order = persistedOrder ? {
            id: persistedOrder.orderId,
            symbol: persistedOrder.symbol,
            side: persistedOrder.side,
            type: persistedOrder.orderType,
            price: persistedOrder.price,
            quantity: persistedOrder.quantity,
            filled_qty: persistedOrder.filled_qty,
            remaining_qty: persistedOrder.remaining_qty,
            avg_fill_price: persistedOrder.avg_fill_price,
            status: persistedOrder.status,
            user_id: persistedOrder.userId,
            timestamp: persistedOrder.timestamp || persistedOrder.createdAt
        } : runtimeOrder;

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }

        res.json({ order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Persisted portfolio snapshot
app.get(['/api/portfolio', '/api/portfolio/:userId'], requireAuth, async (req, res) => {
    try {
        const targetUserId = req.params.userId || req.user.id;
        if (targetUserId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        const portfolio = await persistenceService.getPortfolio(targetUserId);

        if (!portfolio) {
            const user = users.get(targetUserId);
            const userBalance = user?.balance || 0;
            const openBuyOrders = (userOrders.get(targetUserId) || []).filter(
                (o) => o.side === 'BUY' && ['OPEN', 'PARTIALLY_FILLED'].includes(o.status)
            );
            const reservedCash = openBuyOrders.reduce(
                (sum, o) => sum + Number(o.price || 0) * Number(o.remaining_qty || 0),
                0
            );
            const positions = buildPositionsFromOrders(userOrders.get(targetUserId) || []);
            const totalInvested = positions.reduce((sum, p) => sum + Number(p.invested || 0), 0);
            const positionsValue = positions.reduce(
                (sum, p) => sum + Number(p.marketValue || (p.quantity * (p.marketPrice || p.avgPrice || 0))),
                0
            );

            const unrealizedPnl = positionsValue - totalInvested;
            const realizedPnl = positions.reduce((sum, p) => sum + Number(p.realizedPnl || 0), 0);
            const totalPnl = unrealizedPnl + realizedPnl;

            return res.json({
                user: user ? { id: user.id, balance: userBalance, currency: 'INR' } : null,
                summary: {
                    cashBalance: userBalance,
                    reservedCash,
                    availableCash: Math.max(0, userBalance - reservedCash),
                    investedValue: totalInvested,
                    positionsValue,
                    totalPortfolioValue: userBalance + positionsValue,
                    unrealizedPnl,
                    realizedPnl,
                    totalPnl
                },
                positions,
                orders: userOrders.get(targetUserId) || [],
                trades: Array.from(trades.values()).filter(
                    (trade) => trade.buyer_id === targetUserId || trade.seller_id === targetUserId
                )
            });
        }

        res.json({
            ...portfolio,
            trades: Array.isArray(portfolio.trades)
                ? portfolio.trades.map((trade) => projectTradeForUser(trade, targetUserId))
                : []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get positions
app.get(['/api/positions', '/api/positions/:userId'], requireAuth, async (req, res) => {
    try {
        const targetUserId = req.params.userId || req.user.id;
        if (targetUserId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        const positions = await persistenceService.getPositions(targetUserId);
        if (positions.length === 0) {
            return res.json({
                positions: buildPositionsFromOrders(userOrders.get(targetUserId) || [])
            });
        }

        res.json({ positions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Watchlist APIs
app.get(['/api/market/watchlist', '/api/market/watchlist/:userId'], requireAuth, async (req, res) => {
    try {
        const targetUserId = req.params.userId || req.user.id;
        if (targetUserId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        const watchlist = await persistenceService.getWatchlist(targetUserId);
        const symbols = watchlist?.symbols || DEFAULT_WATCHLIST;
        const quotes = await marketDataService.getQuotes(symbols.map((entry) => entry.symbol));

        res.json({
            userId: targetUserId,
            symbols,
            quotes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put(['/api/market/watchlist', '/api/market/watchlist/:userId'], requireAuth, async (req, res) => {
    try {
        const targetUserId = req.params.userId || req.user.id;
        if (targetUserId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        const symbols = Array.isArray(req.body.symbols) ? req.body.symbols : [];
        const normalizedSymbols = symbols.map((entry) => ({
            symbol: entry.symbol,
            assetType: entry.assetType || inferAssetType(entry.symbol)
        }));

        await persistenceService.saveWatchlist(targetUserId, normalizedSymbols);

        res.json({
            success: true,
            userId: targetUserId,
            symbols: normalizedSymbols
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Notification APIs
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await persistenceService.getNotifications(req.user.id);
        const unreadCount = notifications.filter((n) => !n.read).length;
        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const updated = await persistenceService.markNotificationRead(req.params.id, req.user.id);
        res.json({ success: true, notification: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
    try {
        await persistenceService.markAllNotificationsRead(req.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trade ingest endpoint for external engine events
app.post('/api/trades/ingest', requireAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        if (payload.userId && payload.userId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden resource' });
        }
        payload.userId = req.user.id;

        if (!payload.tradeId || !payload.symbol || !payload.quantity || !payload.price) {
            return res.status(400).json({
                error: 'Missing required fields: tradeId, symbol, quantity, price'
            });
        }

        const trade = {
            id: payload.tradeId,
            orderId: payload.orderId || null,
            symbol: payload.symbol,
            quantity: Number(payload.quantity),
            price: Number(payload.price),
            buyer_id: payload.buyer_id || null,
            seller_id: payload.seller_id || null,
            side: payload.side || null,
            timestamp: payload.timestamp || Date.now(),
            executedAt: payload.executedAt || new Date().toISOString()
        };

        trades.set(trade.id, trade);
        await persistenceService.saveTrade(trade, {
            userId: payload.userId || null,
            orderId: payload.orderId || null,
            assetType: payload.assetType || inferAssetType(payload.symbol),
            side: payload.side || null
        });

        if (payload.userId && payload.side) {
            await persistenceService.applyTradeToPosition({
                userId: payload.userId,
                symbol: payload.symbol,
                assetType: payload.assetType || inferAssetType(payload.symbol),
                side: payload.side,
                quantity: Number(payload.quantity),
                price: Number(payload.price)
            });

            const runtimeUser = users.get(payload.userId);
            if (runtimeUser) {
                const currentQty = Number(runtimeUser.positions.get(payload.symbol) || 0);
                const deltaQty = payload.side === 'BUY' ? Number(payload.quantity) : -Number(payload.quantity);
                runtimeUser.positions.set(payload.symbol, currentQty + deltaQty);
            } else {
                const persistedUser = await persistenceService.getUser(payload.userId);
                if (persistedUser) {
                    users.set(payload.userId, persistedUser);
                }
            }
            await syncUserSnapshot(payload.userId);
        }

        res.json({ success: true, trade });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===================== WEBSOCKET =====================
// Simple polling endpoint for now
app.get('/api/stream/orderbook/:symbol', async (req, res) => {
    try {
        const symbol = String(req.params.symbol || '').trim().toUpperCase();
        const response = await matchingEngine.sendRequest('GET_BOOK', symbol);
        const parsed = parseEngineResponse(response);

        if (parsed.kind === 'BOOK' && parsed.payload) {
            const bookData = JSON.parse(parsed.payload);
            res.json({
                symbol,
                ...bookData,
                timestamp: Date.now()
            });
        } else {
            res.json({ symbol, bids: [], asks: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Track WebSocket server for graceful shutdown
let marketWss = null;

async function createMarketWebSocketServer() {
    const wss = new WebSocket.Server({ server, path: '/ws/market' });
    marketWss = wss;

    wss.on('connection', (socket, req) => {
        const requestUrl = new URL(req.url, `http://${req.headers.host}`);
        const initialSymbols = (requestUrl.searchParams.get('symbols') || '')
            .split(',')
            .map((symbol) => symbol.trim())
            .filter(Boolean);

        let subscription = {
            symbols: initialSymbols,
            assetType: requestUrl.searchParams.get('assetType') || null
        };

        let intervalHandle = null;

        const publishQuotes = async () => {
            if (!subscription.symbols.length || socket.readyState !== WebSocket.OPEN) {
                return;
            }

            try {
                const quotes = await marketDataService.getQuotes(subscription.symbols, subscription.assetType);
                socket.send(JSON.stringify({
                    type: 'market_quotes',
                    data: quotes
                }));
            } catch (error) {
                socket.send(JSON.stringify({
                    type: 'market_error',
                    error: error.message
                }));
            }
        };

        const restartStream = () => {
            if (intervalHandle) {
                clearInterval(intervalHandle);
            }
            publishQuotes();
            intervalHandle = setInterval(publishQuotes, 1000);
        };

        socket.on('message', (raw) => {
            try {
                const payload = JSON.parse(raw.toString());
                if (payload.type === 'subscribe') {
                    subscription = {
                        symbols: Array.isArray(payload.symbols) ? payload.symbols : subscription.symbols,
                        assetType: payload.assetType || subscription.assetType
                    };
                    restartStream();
                }
            } catch (error) {
                socket.send(JSON.stringify({
                    type: 'market_error',
                    error: 'Invalid subscription payload'
                }));
            }
        });

        socket.on('close', () => {
            if (intervalHandle) {
                clearInterval(intervalHandle);
            }
        });

        restartStream();
    });
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    const shutdown = () => {
        marketWss?.close(() => {
            console.log('WebSocket server closed');
            server.close(() => {
                console.log('HTTP server closed');
                persistenceService.close().then(() => {
                    console.log('Database connections closed');
                    process.exit(0);
                }).catch(() => {
                    process.exit(0);
                });
            });
        });
    };

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);

    shutdown();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
async function startServer() {
    const dbStatus = await persistenceService.init();
    await persistenceService.ensureUser(users.get(DEFAULT_USER_ID));
    await persistenceService.saveWatchlist(DEFAULT_USER_ID, DEFAULT_WATCHLIST);
    await createMarketWebSocketServer();

    if (persistenceService.isEnabled()) {
        const hydration = await persistenceService.hydrateRuntimeState(
            DEFAULT_USER_ID,
            users,
            userOrders,
            trades
        );
        console.log('Database hydration:', hydration);
    }

    await runSymbolSync();
    const symbolSyncIntervalMs = Number(process.env.SYMBOL_SYNC_INTERVAL_MS || 24 * 60 * 60 * 1000);
    setInterval(() => {
        runSymbolSync().catch((error) => {
            console.error('Scheduled symbol sync failed:', error.message);
        });
    }, symbolSyncIntervalMs);

    // Check if port is already in use before attempting to listen
    const portInUse = await new Promise((resolve) => {
        const testServer = require('net').createServer();
        testServer.once('error', (err) => {
            resolve(err.code === 'EADDRINUSE');
        });
        testServer.once('listening', () => {
            testServer.close();
            resolve(false);
        });
        testServer.listen(PORT);
    });

    if (portInUse) {
        console.error(`\nError: Port ${PORT} is already in use.`);
        console.error('This usually means another instance of the server is running.');
        console.error('\nTo fix this:');
        console.error('  1. Stop the other process using port 3001');
        console.error('  2. Or change BACKEND_PORT in your .env file');
        console.error('\nTo find and kill the process:');
        console.error('  Windows: netstat -ano | findstr :3001, then taskkill /PID <PID> /F');
        console.error('  Unix:    lsof -i :3001, then kill -9 <PID>\n');
        process.exit(1);
    }

    server.listen(PORT, () => {
        console.log('====================================');
        console.log('  AI Trading - Backend API');
        console.log('  Version 1.1.0');
        console.log('====================================');
        console.log(`Server running on port ${PORT}`);
        console.log(`ML Service: ${ML_SERVICE_URL}`);
        console.log(`Matching Engine: ${MATCHING_ENGINE_HOST}:${MATCHING_ENGINE_PORT}`);
        console.log(
            `Database: ${dbStatus.enabled ? 'connected' : `disabled (${dbStatus.reason})`}`
        );
    });

    server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`\nError: Port ${PORT} is already in use.`);
            console.error('Another instance of the server may be running.');
            console.error('Try: netstat -ano | findstr :3001 to find the process\n');
        }
        throw error;
    });
}

startServer().catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
});
