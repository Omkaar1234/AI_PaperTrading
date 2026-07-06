/**
 * Trading Service
 * Re-exports the matching engine for backward compatibility
 * All trading logic is now in matchingEngine.js
 */

const matchingEngine = require('./matchingEngine');

// Re-export all functions from matching engine
module.exports = {
    placeOrder: matchingEngine.placeOrder,
    getOrderBook: matchingEngine.getOrderBook,
    getTrades: matchingEngine.getTrades,
    getOrderById: matchingEngine.getOrderById,
    cancelOrder: matchingEngine.cancelOrder,
    clearAll: matchingEngine.clearAll,
    getOrderBookStats: matchingEngine.getOrderBookStats
};
