#pragma once

#include "order_book.hpp"
#include <sstream>
#include <iomanip>
#include <fstream>
#include <atomic>

namespace trading {

class TradeLogger {
public:
    TradeLogger(const std::string& log_file);
    ~TradeLogger();

    void log_trade(const Trade& trade);
    void log_order(const Order& order, const std::string& action);
    void flush();

private:
    std::ofstream log_stream_;
    std::mutex log_mutex_;

    std::string timestamp_to_string(uint64_t timestamp_ns);
};

class TradeExecutor {
public:
    TradeExecutor(OrderBookManager& manager, const std::string& log_file);

    // Execute order and return fill details
    struct ExecutionResult {
        bool success;
        std::string order_id;
        uint32_t filled_qty;
        uint32_t remaining_qty;
        double avg_fill_price;
        std::vector<std::string> trade_ids;
        std::vector<Trade> trades;
        std::string error_message;
    };

    ExecutionResult submit_order(const Order& order);
    bool cancel_order(const std::string& symbol, const std::string& order_id);

    // Recovery
    void replay_log(const std::string& log_file);

private:
    OrderBookManager& book_manager_;
    TradeLogger logger_;
    std::atomic<uint64_t> order_counter_{0};

    std::string generate_order_id();
};

// JSON serialization helpers for network communication
std::string order_to_json(const Order& order);
std::string trade_to_json(const Trade& trade);
Order json_to_order(const std::string& json_str);
std::string order_book_to_json(const OrderBook& book, int depth = 10);

} // namespace trading
