const { connectDatabase } = require('../config/db');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Trade = require('../models/tradeModel');
const Position = require('../models/positionModel');
const Watchlist = require('../models/watchlistModel');
const MarketDataCache = require('../models/marketDataCacheModel');
const Symbol = require('../models/symbolModel');
const Notification = require('../models/notificationModel');

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function objectToPositionMap(positionDocs) {
  const positions = new Map();
  positionDocs.forEach((position) => {
    positions.set(position.symbol, position.quantity);
  });
  return positions;
}

class PersistenceService {
  constructor() {
    this.enabled = false;
    this.reason = 'not_initialized';
  }

  async init() {
    try {
      const result = await connectDatabase();
      this.enabled = result.enabled;
      this.reason = result.reason;
    } catch (error) {
      this.enabled = false;
      this.reason = error.message;
      console.error('Database initialization failed:', error.message);
    }

    return { enabled: this.enabled, reason: this.reason };
  }

  isEnabled() {
    return this.enabled && User && Order && Trade && Position && Watchlist && MarketDataCache;
  }

  hasSymbolStore() {
    return this.isEnabled() && Symbol;
  }

  async ensureUser(user) {
    if (!this.isEnabled()) {
      return user;
    }

    const doc = await User.findOneAndUpdate(
      { userId: user.id },
      {
        userId: user.id,
        name: user.name || 'Paper Trader',
        email: user.email || null,
        age: user.age || null,
        authProvider: user.authProvider || 'demo',
        initialBalance: user.initialBalance ?? user.balance,
        currentBalance: user.balance,
        wallet: {
          cashBalance: user.balance,
          currency: user.currency || 'INR',
          buyingPower: user.balance
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return doc;
  }

  async saveUserState(user) {
    if (!this.isEnabled()) {
      return null;
    }

    return User.findOneAndUpdate(
      { userId: user.id },
      {
        userId: user.id,
        currentBalance: user.balance,
        wallet: {
          cashBalance: user.balance,
          currency: user.currency || 'INR',
          buyingPower: user.balance
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async getUser(userId) {
    if (!this.isEnabled()) {
      return null;
    }

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return null;
    }

    const positions = await Position.find({ userId }).lean();

    return {
      id: user.userId,
      name: user.name,
      email: user.email,
      age: user.age,
      authProvider: user.authProvider,
      initialBalance: user.initialBalance,
      balance: user.wallet?.cashBalance ?? 0,
      currentBalance: user.currentBalance ?? user.wallet?.cashBalance ?? 0,
      currency: user.wallet?.currency || 'INR',
      positions: objectToPositionMap(positions)
    };
  }

  async saveOrder(order, options = {}) {
    if (!this.isEnabled()) {
      return null;
    }

    const payload = {
      orderId: order.id,
      userId: order.user_id || options.userId || 'user_001',
      symbol: order.symbol || options.symbol || 'DEFAULT',
      assetType: options.assetType || 'unknown',
      exchange: options.exchange || null,
      side: order.side || order.type,
      orderType: order.type || options.orderType || 'LIMIT',
      timeInForce: options.timeInForce || 'GTC',
      price: order.price,
      quantity: order.quantity,
      filled_qty: order.filled_qty ?? order.filled ?? 0,
      remaining_qty: order.remaining_qty ?? order.remaining ?? 0,
      avg_fill_price: order.avg_fill_price ?? 0,
      status: order.status || 'OPEN',
      source: options.source || 'frontend',
      engineOrderRef: options.engineOrderRef || order.id,
      submittedAt: options.submittedAt || new Date(),
      lastEventAt: new Date(),
      timestamp: order.timestamp || new Date().toISOString()
    };

    return Order.findOneAndUpdate({ orderId: payload.orderId }, payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });
  }

  async getOrdersByUser(userId, limit = 200) {
    if (!this.isEnabled()) {
      return [];
    }

    return Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getOrderById(orderId) {
    if (!this.isEnabled()) {
      return null;
    }

    return Order.findOne({ orderId }).lean();
  }

  async saveTrade(trade, options = {}) {
    if (!this.isEnabled()) {
      return null;
    }

    const payload = {
      tradeId: trade.id,
      orderId: options.orderId || trade.orderId || null,
      engineTradeRef: options.engineTradeRef || null,
      userId: options.userId || trade.userId || null,
      buyer_id: trade.buyer_id || null,
      seller_id: trade.seller_id || null,
      symbol: trade.symbol,
      assetType: options.assetType || 'unknown',
      side: options.side || trade.side || null,
      quantity: trade.quantity,
      price: trade.price,
      notional: trade.notional || trade.price * trade.quantity,
      fees: trade.fees || 0,
      counterpartyOrderId: trade.counterpartyOrderId || null,
      executedAt: trade.executedAt ? new Date(trade.executedAt) : new Date(),
      timestamp: trade.timestamp || Date.now()
    };

    return Trade.findOneAndUpdate({ tradeId: payload.tradeId }, payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });
  }

  async getTradesByUser(userId, limit = 200) {
    if (!this.isEnabled()) {
      return [];
    }

    return Trade.find({
      $or: [{ userId }, { buyer_id: userId }, { seller_id: userId }]
    })
      .sort({ executedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getRecentTrades(limit = 100) {
    if (!this.isEnabled()) {
      return [];
    }

    return Trade.find({})
      .sort({ executedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async replacePositions(userId, positions) {
    if (!this.isEnabled()) {
      return [];
    }

    const writes = positions.map((position) => ({
      updateOne: {
        filter: { userId, symbol: position.symbol },
        update: {
          $set: {
            userId,
            symbol: position.symbol,
            assetType: position.assetType || 'unknown',
            quantity: position.quantity,
            averagePrice: position.avgPrice || 0,
            invested: position.invested || 0,
            marketPrice: position.marketPrice || 0,
            marketValue: position.marketValue || 0,
            unrealizedPnl: position.unrealizedPnl || 0,
            realizedPnl: position.realizedPnl || 0,
            lastUpdatedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    if (writes.length > 0) {
      await Position.bulkWrite(writes);
    }

    const symbols = positions.map((position) => position.symbol);
    await Position.deleteMany({ userId, symbol: { $nin: symbols } });

    return Position.find({ userId }).lean();
  }

  async applyTradeToPosition({ userId, symbol, assetType = 'unknown', side, quantity, price }) {
    if (!this.isEnabled() || !userId || !symbol || !side || !quantity) {
      return null;
    }

    const existing = await Position.findOne({ userId, symbol });
    const current = existing || new Position({ userId, symbol, assetType });
    const qty = Number(quantity);
    const tradePrice = Number(price || 0);

    if (side === 'BUY') {
      const nextQuantity = Number(current.quantity || 0) + qty;
      const nextInvested = Number(current.invested || 0) + qty * tradePrice;
      current.quantity = nextQuantity;
      current.invested = nextInvested;
      current.averagePrice = nextQuantity > 0 ? nextInvested / nextQuantity : 0;
    } else if (side === 'SELL') {
      const prevQuantity = Number(current.quantity || 0);
      const avgPrice = Number(current.averagePrice || 0);
      const nextQuantity = Math.max(0, prevQuantity - qty);
      const nextInvested = Math.max(0, Number(current.invested || 0) - qty * avgPrice);
      current.quantity = nextQuantity;
      current.invested = nextInvested;
      current.averagePrice = nextQuantity > 0 ? nextInvested / nextQuantity : 0;
      current.realizedPnl = Number(current.realizedPnl || 0) + qty * (tradePrice - avgPrice);
    }

    current.assetType = assetType;
    current.lastUpdatedAt = new Date();
    current.marketPrice = tradePrice;
    current.marketValue = Number(current.quantity || 0) * tradePrice;
    current.unrealizedPnl = Number(current.quantity || 0) * (tradePrice - Number(current.averagePrice || 0));

    if (current.quantity === 0) {
      await Position.deleteOne({ userId, symbol });
      return null;
    }

    await current.save();
    return current.toObject();
  }

  async getPositions(userId) {
    if (!this.isEnabled()) {
      return [];
    }

    const positions = await Position.find({ userId }).sort({ symbol: 1 }).lean();
    return positions.map((p) => ({
      ...p,
      avgPrice: p.averagePrice ?? p.avgPrice ?? (p.quantity > 0 ? p.invested / p.quantity : 0)
    }));
  }

  async saveWatchlist(userId, symbols) {
    if (!this.isEnabled()) {
      return null;
    }

    return Watchlist.findOneAndUpdate(
      { userId, isDefault: true },
      {
        userId,
        name: 'Primary',
        isDefault: true,
        symbols
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async getWatchlist(userId) {
    if (!this.isEnabled()) {
      return null;
    }

    return Watchlist.findOne({ userId, isDefault: true }).lean();
  }

  async saveMarketQuote(symbol, assetType, quote, provider = 'internal') {
    if (!this.isEnabled()) {
      return null;
    }

    return MarketDataCache.findOneAndUpdate(
      { symbol, assetType, provider, interval: '1m' },
      {
        symbol,
        assetType,
        provider,
        interval: '1m',
        quote,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 1000)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async bulkUpsertSymbols(symbols = []) {
    if (!this.hasSymbolStore() || !Array.isArray(symbols) || symbols.length === 0) {
      return { upserted: 0 };
    }

    const writes = symbols
      .filter((entry) => entry?.symbol)
      .map((entry) => ({
        updateOne: {
          filter: { symbol: entry.symbol },
          update: {
            $set: {
              ...entry,
              isActive: entry.isActive !== false,
              lastSyncedAt: entry.lastSyncedAt || new Date()
            }
          },
          upsert: true
        }
      }));

    if (!writes.length) {
      return { upserted: 0 };
    }

    const result = await Symbol.bulkWrite(writes, { ordered: false });
    return {
      upserted:
        Number(result.upsertedCount || 0) +
        Number(result.modifiedCount || 0) +
        Number(result.matchedCount || 0)
    };
  }

  async findSymbols(options = {}) {
    if (!this.hasSymbolStore()) {
      return {
        symbols: [],
        pagination: {
          page: 1,
          limit: options.limit || 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false
        }
      };
    }

    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(250, Math.max(1, Number(options.limit || 20)));
    const filter = { isActive: true };

    if (options.type) {
      filter.type = options.type;
    }

    if (options.exchange) {
      filter.exchange = String(options.exchange).toUpperCase();
    }

    if (options.marketCapCategory) {
      filter.marketCapCategory = String(options.marketCapCategory).toLowerCase();
    }

    if (Array.isArray(options.symbols) && options.symbols.length > 0) {
      filter.symbol = { $in: options.symbols.map((symbol) => String(symbol).toUpperCase()) };
    } else if (options.q) {
      const normalized = String(options.q).trim().toLowerCase();
      const safePattern = escapeRegex(normalized);
      filter.$or = [
        { symbol: { $regex: safePattern, $options: 'i' } },
        { baseSymbol: { $regex: safePattern, $options: 'i' } },
        { name: { $regex: safePattern, $options: 'i' } },
        { searchText: { $regex: safePattern, $options: 'i' } }
      ];
    }

    const [symbols, total] = await Promise.all([
      Symbol.find(filter)
        .sort(options.q ? { marketCapCategory: 1, symbol: 1 } : { type: 1, exchange: 1, symbol: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Symbol.countDocuments(filter)
    ]);

    return {
      symbols,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
        hasNextPage: page * limit < total
      }
    };
  }

  async getPortfolio(userId) {
    if (!this.isEnabled()) {
      return null;
    }

    const [user, positions, orders, trades] = await Promise.all([
      User.findOne({ userId }).lean(),
      Position.find({ userId }).sort({ symbol: 1 }).lean(),
      Order.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
      Trade.find({
        $or: [{ userId }, { buyer_id: userId }, { seller_id: userId }]
      })
        .sort({ executedAt: -1, createdAt: -1 })
        .limit(50)
        .lean()
    ]);

    if (!user) {
      return null;
    }

    const totalInvested = positions.reduce(
      (sum, position) => sum + Number(position.invested || (position.quantity * (position.averagePrice || 0))),
      0
    );
    const positionsValue = positions.reduce(
      (sum, position) => sum + (position.marketValue || position.quantity * (position.marketPrice || position.averagePrice || 0)),
      0
    );
    const openBuyOrders = orders.filter(
      (o) => o.side === 'BUY' && ['OPEN', 'PARTIALLY_FILLED'].includes(o.status)
    );
    const reservedCash = openBuyOrders.reduce(
      (sum, o) => sum + Number(o.price || 0) * Number(o.remaining_qty || 0),
      0
    );
    const cashBalance = user.wallet?.cashBalance ?? user.currentBalance ?? 0;
    const unrealizedPnl = positionsValue - totalInvested;
    const realizedPnl = positions.reduce((sum, p) => sum + Number(p.realizedPnl || 0), 0);
    const totalPnl = unrealizedPnl + realizedPnl;

    return {
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        balance: cashBalance,
        currentBalance: cashBalance,
        currency: user.wallet?.currency || 'INR'
      },
      summary: {
        cashBalance,
        reservedCash,
        availableCash: Math.max(0, cashBalance - reservedCash),
        investedValue: totalInvested,
        positionsValue,
        totalPortfolioValue: cashBalance + positionsValue,
        unrealizedPnl,
        realizedPnl,
        totalPnl
      },
      positions: positions.map((position) => ({
        symbol: position.symbol,
        assetType: position.assetType,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        avgPrice: position.averagePrice ?? position.avgPrice ?? (position.quantity > 0 ? position.invested / position.quantity : 0),
        invested: position.invested,
        marketPrice: position.marketPrice,
        marketValue: position.marketValue,
        unrealizedPnl: position.unrealizedPnl,
        realizedPnl: position.realizedPnl,
        lastUpdatedAt: position.lastUpdatedAt
      })),
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
      })),
      trades: trades.map((trade) => ({
        id: trade.tradeId,
        orderId: trade.orderId,
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
        side: trade.side,
        timestamp: trade.timestamp,
        executedAt: trade.executedAt
      }))
    };
  }

  async hydrateRuntimeState(defaultUserId, usersMap, userOrdersMap, tradesMap) {
    if (!this.isEnabled()) {
      return { hydrated: false, reason: this.reason };
    }

    const [user, positions, orders, trades] = await Promise.all([
      User.findOne({ userId: defaultUserId }).lean(),
      Position.find({ userId: defaultUserId }).lean(),
      Order.find({ userId: defaultUserId }).sort({ createdAt: 1 }).lean(),
      Trade.find({}).sort({ executedAt: 1, createdAt: 1 }).lean()
    ]);

    if (user) {
      usersMap.set(defaultUserId, {
        id: defaultUserId,
        balance: user.wallet?.cashBalance ?? 0,
        positions: objectToPositionMap(positions)
      });
    }

    userOrdersMap.set(defaultUserId, orders.map((order) => ({
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
      timestamp: order.timestamp || order.createdAt?.toISOString?.() || new Date().toISOString()
    })));

    tradesMap.clear();
    trades.forEach((trade) => {
      tradesMap.set(trade.tradeId, {
        id: trade.tradeId,
        orderId: trade.orderId,
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
        userId: trade.userId,
        side: trade.side,
        timestamp: trade.timestamp || Date.now(),
        executedAt: trade.executedAt?.toISOString?.() || new Date().toISOString()
      });
    });

    return {
      hydrated: true,
      orders: orders.length,
      trades: trades.length,
      positions: positions.length
    };
  }

  async createNotification(data) {
    if (!this.isEnabled() || !Notification) {
      return null;
    }
    const notificationId = data.notificationId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return Notification.create({
      notificationId,
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || 'INFO',
      read: false,
      metadata: data.metadata || {}
    });
  }

  async getNotifications(userId, limit = 50) {
    if (!this.isEnabled() || !Notification) {
      return [];
    }
    return Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async markNotificationRead(notificationId, userId) {
    if (!this.isEnabled() || !Notification) {
      return null;
    }
    return Notification.findOneAndUpdate(
      { notificationId, userId },
      { read: true },
      { new: true }
    );
  }

  async markAllNotificationsRead(userId) {
    if (!this.isEnabled() || !Notification) {
      return { modifiedCount: 0 };
    }
    return Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
  }
}

module.exports = new PersistenceService();
