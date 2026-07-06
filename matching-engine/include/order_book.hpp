#pragma once

#include "order.hpp"
#include <map>
#include <queue>
#include <vector>
#include <memory>
#include <mutex>
#include <functional>
#include <unordered_map>
#include <unordered_set>

namespace trading {

// Price-time priority comparator for buy orders (highest price first, then earliest time)
struct BuyComparator {
    bool operator()(const Order* a, const Order* b) const {
        if (a->price != b->price) return a->price < b->price; // Higher price has priority
        return a->timestamp > b->timestamp; // Earlier timestamp has priority
    }
};

// Price-time priority comparator for sell orders (lowest price first, then earliest time)
struct SellComparator {
    bool operator()(const Order* a, const Order* b) const {
        if (a->price != b->price) return a->price > b->price; // Lower price has priority
        return a->timestamp > b->timestamp; // Earlier timestamp has priority
    }
};

class OrderBook {
public:
    using TradeCallback = std::function<void(const Trade&)>;
    using OrderUpdateCallback = std::function<void(const Order&)>;

    OrderBook(const std::string& symbol);

    // Order management
    bool add_order(Order order);
    bool cancel_order(const std::string& order_id);
    std::shared_ptr<Order> get_order(const std::string& order_id) const;

    // Matching
    void process_matches();

    // Market data
    double get_best_bid() const;
    double get_best_ask() const;
    double get_spread() const;
    uint32_t get_bid_depth(double price) const;
    uint32_t get_ask_depth(double price) const;

    // Book snapshot
    std::vector<std::pair<double, uint32_t>> get_bid_levels(int depth = 10) const;
    std::vector<std::pair<double, uint32_t>> get_ask_levels(int depth = 10) const;

    // Callbacks
    void set_trade_callback(TradeCallback callback) { trade_callback_ = callback; }
    void set_order_update_callback(OrderUpdateCallback callback) { order_update_callback_ = callback; }

    // Stats
    size_t order_count() const { return order_index_.size(); }
    uint64_t total_volume() const { return total_volume_traded_; }

    // Persistence
    void save_state(const std::string& filename) const;
    void load_state(const std::string& filename);

private:
    std::string symbol_;

    // Priority queues for price-time ordering
    std::priority_queue<Order*, std::vector<Order*>, BuyComparator> buy_queue_;
    std::priority_queue<Order*, std::vector<Order*>, SellComparator> sell_queue_;

    // Fast lookup for order modification/cancellation
    std::unordered_map<std::string, std::shared_ptr<Order>> order_index_;

    // Track orders that need to be removed from queues (lazy deletion)
    std::unordered_set<std::string> cancelled_orders_;

    // Price level aggregation
    std::map<double, uint32_t, std::greater<double>> bid_levels_; // Descending
    std::map<double, uint32_t> ask_levels_; // Ascending

    mutable std::mutex mutex_;
    uint64_t total_volume_traded_ = 0;

    TradeCallback trade_callback_;
    OrderUpdateCallback order_update_callback_;

    // Helper methods
    void match_order(Order& order);
    void execute_trade(Order& buy_order, Order& sell_order, uint32_t qty, double price);
    void update_price_level(OrderSide side, double price, int32_t qty_delta);
    void clean_cancelled_orders();
    std::string generate_trade_id();
};

// Multi-symbol order book manager
class OrderBookManager {
public:
    std::shared_ptr<OrderBook> get_or_create_book(const std::string& symbol);
    std::shared_ptr<OrderBook> get_book(const std::string& symbol) const;
    std::vector<std::string> get_symbols() const;

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::string, std::shared_ptr<OrderBook>> books_;
};

} // namespace trading
