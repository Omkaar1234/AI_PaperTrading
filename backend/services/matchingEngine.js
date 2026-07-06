/**
 * Matching Engine Service
 * Implements price-time priority order matching
 *
 * PRICE-TIME PRIORITY EXPLANATION:
 * ================================
 *
 * For BUY orders:
 *   - Sorted by: Highest price FIRST
 *   - Then by: Earliest timestamp FIRST
 *   - Example: $105 (10:00) matches before $105 (10:01) and before $104 (any time)
 *
 * For SELL orders:
 *   - Sorted by: Lowest price FIRST
 *   - Then by: Earliest timestamp FIRST
 *   - Example: $95 (10:00) matches before $95 (10:01) and before $96 (any time)
 *
 * MATCHING RULES:
 * ==============
 * 1. A BUY order matches if its price >= SELL order price
 * 2. A SELL order matches if its price <= BUY order price
 * 3. Execution price = the price of the order that was ALREADY in the book (resting order)
 * 4. Partial fills supported - remaining quantity stays in book
 * 5. Fully filled orders are removed from the book
 */

const { v4: uuidv4 } = require('uuid');

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const buyOrders = new Map();   // symbol -> array of buy orders
const sellOrders = new Map();  // symbol -> array of sell orders
const executedTrades = [];     // array of all executed trades

// ============================================================================
// ORDER CLASS
// ============================================================================

class Order {
    constructor(type, price, quantity, symbol = 'DEFAULT') {
        this.id = `order_${uuidv4().split('-')[0]}`;
        this.type = type;           // 'BUY' or 'SELL'
        this.price = parseFloat(price);
        this.quantity = parseInt(quantity);
        this.symbol = symbol;
        this.filled = 0;
        this.remaining = this.quantity;
        this.status = 'OPEN';         // OPEN, PARTIALLY_FILLED, FILLED
        this.timestamp = Date.now();  // For price-time priority
        this.createdAt = new Date().toISOString();
    }

    /**
     * Fill part or all of this order
     * @param {number} quantity - Amount to fill
     */
    fill(quantity) {
        const fillQty = Math.min(quantity, this.remaining);
        this.filled += fillQty;
        this.remaining -= fillQty;

        if (this.remaining === 0) {
            this.status = 'FILLED';
        } else if (this.filled > 0) {
            this.status = 'PARTIALLY_FILLED';
        }

        return fillQty;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            symbol: this.symbol,
            price: this.price,
            quantity: this.quantity,
            filled: this.filled,
            remaining: this.remaining,
            status: this.status,
            timestamp: this.timestamp,
            createdAt: this.createdAt
        };
    }
}

// ============================================================================
// TRADE CLASS
// ============================================================================

class Trade {
    constructor(buyOrder, sellOrder, price, quantity) {
        this.id = `trade_${uuidv4().split('-')[0]}`;
        this.buyOrderId = buyOrder.id;
        this.sellOrderId = sellOrder.id;
        this.symbol = buyOrder.symbol;
        this.price = price;           // Execution price (resting order's price)
        this.quantity = quantity;
        this.timestamp = Date.now();
        this.executedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            buyOrderId: this.buyOrderId,
            sellOrderId: this.sellOrderId,
            symbol: this.symbol,
            price: this.price,
            quantity: this.quantity,
            timestamp: this.timestamp,
            executedAt: this.executedAt
        };
    }
}

// ============================================================================
// ORDER BOOK MANAGEMENT
// ============================================================================

/**
 * Get or initialize buy orders array for a symbol
 */
function getBuyOrders(symbol = 'DEFAULT') {
    if (!buyOrders.has(symbol)) {
        buyOrders.set(symbol, []);
    }
    return buyOrders.get(symbol);
}

/**
 * Get or initialize sell orders array for a symbol
 */
function getSellOrders(symbol = 'DEFAULT') {
    if (!sellOrders.has(symbol)) {
        sellOrders.set(symbol, []);
    }
    return sellOrders.get(symbol);
}

/**
 * Add order to buy book with proper sorting
 * Sort: Highest price first, then earliest timestamp
 */
function addBuyOrder(order) {
    const orders = getBuyOrders(order.symbol);
    orders.push(order);

    // Sort by price DESC, then timestamp ASC
    orders.sort((a, b) => {
        if (a.price !== b.price) {
            return b.price - a.price;  // Higher price first
        }
        return a.timestamp - b.timestamp;  // Earlier time first
    });
}

/**
 * Add order to sell book with proper sorting
 * Sort: Lowest price first, then earliest timestamp
 */
function addSellOrder(order) {
    const orders = getSellOrders(order.symbol);
    orders.push(order);

    // Sort by price ASC, then timestamp ASC
    orders.sort((a, b) => {
        if (a.price !== b.price) {
            return a.price - b.price;  // Lower price first
        }
        return a.timestamp - b.timestamp;  // Earlier time first
    });
}

/**
 * Remove filled orders from the book
 */
function cleanupFilledOrders(symbol) {
    const buys = getBuyOrders(symbol);
    const sells = getSellOrders(symbol);

    // Keep only non-filled orders
    const activeBuys = buys.filter(o => o.status !== 'FILLED');
    const activeSells = sells.filter(o => o.status !== 'FILLED');

    buyOrders.set(symbol, activeBuys);
    sellOrders.set(symbol, activeSells);
}

// ============================================================================
// MATCHING LOGIC
// ============================================================================

/**
 * Check if a buy order can match with a sell order
 * BUY matches SELL if buyPrice >= sellPrice
 */
function canMatchBuy(buyPrice, sellPrice) {
    return buyPrice >= sellPrice;
}

/**
 * Check if a sell order can match with a buy order
 * SELL matches BUY if sellPrice <= buyPrice
 */
function canMatchSell(sellPrice, buyPrice) {
    return sellPrice <= buyPrice;
}

/**
 * Execute a trade between two orders
 * Price = resting order's price (price-time priority rule)
 */
function executeTrade(buyOrder, sellOrder) {
    // Match quantity = minimum of remaining amounts
    const matchQuantity = Math.min(buyOrder.remaining, sellOrder.remaining);

    // Execution price = resting order's price (the one already in book)
    // The newer order gets the price of the order that was resting
    const executionPrice = buyOrder.timestamp < sellOrder.timestamp
        ? buyOrder.price      // Buy was resting, use buy price
        : sellOrder.price;    // Sell was resting, use sell price

    // Fill both orders
    buyOrder.fill(matchQuantity);
    sellOrder.fill(matchQuantity);

    // Create trade record
    const trade = new Trade(buyOrder, sellOrder, executionPrice, matchQuantity);
    executedTrades.push(trade);

    return trade;
}

/**
 * Match a BUY order against existing sell orders
 * Processes sells from lowest price up
 */
function matchBuyOrder(newOrder) {
    const trades = [];
    const sells = getSellOrders(newOrder.symbol);

    // Try to match with each sell order (already sorted by lowest price first)
    for (const sellOrder of sells) {
        // Stop if this buy order is fully filled
        if (newOrder.remaining === 0) break;

        // Skip already filled orders
        if (sellOrder.status === 'FILLED') continue;

        // Check if prices cross (buy price >= sell price)
        if (canMatchBuy(newOrder.price, sellOrder.price)) {
            const trade = executeTrade(newOrder, sellOrder);
            trades.push(trade.toJSON());
        } else {
            // Sell price is too high, no more matches possible
            // (sells are sorted by price ascending)
            break;
        }
    }

    return trades;
}

/**
 * Match a SELL order against existing buy orders
 * Processes buys from highest price down
 */
function matchSellOrder(newOrder) {
    const trades = [];
    const buys = getBuyOrders(newOrder.symbol);

    // Try to match with each buy order (already sorted by highest price first)
    for (const buyOrder of buys) {
        // Stop if this sell order is fully filled
        if (newOrder.remaining === 0) break;

        // Skip already filled orders
        if (buyOrder.status === 'FILLED') continue;

        // Check if prices cross (sell price <= buy price)
        if (canMatchSell(newOrder.price, buyOrder.price)) {
            const trade = executeTrade(buyOrder, newOrder);
            trades.push(trade.toJSON());
        } else {
            // Buy price is too low, no more matches possible
            // (buys are sorted by price descending)
            break;
        }
    }

    return trades;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Place a new order and attempt to match it
 * Implements price-time priority matching with partial fill support
 *
 * FLOW:
 * 1. Create order object
 * 2. Try to match against opposite side
 * 3. If unmatched portion remains, add to order book
 * 4. Return order status and any trades
 */
function placeOrder(type, price, quantity, symbol = 'DEFAULT') {
    // Normalize inputs
    const upperType = type.toUpperCase();
    const order = new Order(upperType, price, quantity, symbol);

    let trades = [];

    // Attempt matching based on order side
    if (upperType === 'BUY') {
        // Try to match with existing sells
        trades = matchBuyOrder(order);

        // Add remaining to buy book
        if (order.remaining > 0) {
            addBuyOrder(order);
        }
    } else if (upperType === 'SELL') {
        // Try to match with existing buys
        trades = matchSellOrder(order);

        // Add remaining to sell book
        if (order.remaining > 0) {
            addSellOrder(order);
        }
    }

    // Clean up filled orders from book
    cleanupFilledOrders(symbol);

    return {
        order: order.toJSON(),
        trades: trades,
        filled: order.filled,
        remaining: order.remaining,
        status: order.status
    };
}

/**
 * Get current order book for a symbol
 * Returns bids (buys) and asks (sells)
 */
function getOrderBook(symbol = 'DEFAULT') {
    const buys = getBuyOrders(symbol)
        .filter(o => o.status !== 'FILLED')
        .map(o => o.toJSON());

    const sells = getSellOrders(symbol)
        .filter(o => o.status !== 'FILLED')
        .map(o => o.toJSON());

    return {
        symbol,
        bids: buys,      // Sorted: highest price first
        asks: sells,     // Sorted: lowest price first
        timestamp: new Date().toISOString()
    };
}

/**
 * Get all executed trades
 * @param {number} limit - Maximum number of trades to return (default 100)
 */
function getTrades(limit = 100) {
    return executedTrades
        .slice(-limit)
        .map(t => t.toJSON())
        .reverse();  // Most recent first
}

/**
 * Get a specific order by ID
 */
function getOrderById(orderId) {
    for (const orders of buyOrders.values()) {
        const order = orders.find(o => o.id === orderId);
        if (order) return order;
    }
    for (const orders of sellOrders.values()) {
        const order = orders.find(o => o.id === orderId);
        if (order) return order;
    }
    return null;
}

/**
 * Cancel an order
 */
function cancelOrder(orderId) {
    const order = getOrderById(orderId);
    if (!order) {
        return { success: false, message: 'Order not found' };
    }
    if (order.status === 'FILLED') {
        return { success: false, message: 'Order already filled' };
    }
    if (order.status === 'CANCELLED') {
        return { success: false, message: 'Order already cancelled' };
    }

    order.status = 'CANCELLED';
    return { success: true, message: 'Order cancelled' };
}

/**
 * Clear all orders and trades (for testing)
 */
function clearAll() {
    buyOrders.clear();
    sellOrders.clear();
    executedTrades.length = 0;
}

/**
 * Get order book statistics
 */
function getOrderBookStats(symbol = 'DEFAULT') {
    const buys = getBuyOrders(symbol);
    const sells = getSellOrders(symbol);

    const bestBid = buys.length > 0 ? Math.max(...buys.map(o => o.price)) : null;
    const bestAsk = sells.length > 0 ? Math.min(...sells.map(o => o.price)) : null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null;

    return {
        symbol,
        bidCount: buys.filter(o => o.status !== 'FILLED').length,
        askCount: sells.filter(o => o.status !== 'FILLED').length,
        bestBid,
        bestAsk,
        spread,
        totalTrades: executedTrades.length
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    placeOrder,
    getOrderBook,
    getTrades,
    getOrderById,
    cancelOrder,
    clearAll,
    getOrderBookStats,
    // Export classes for testing
    Order,
    Trade
};
