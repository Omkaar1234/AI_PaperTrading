#include "trade_executor.hpp"
#include <iomanip>
#include <sstream>
#include <fstream>
#include <ctime>
#include <chrono>

namespace trading {

// TradeLogger
TradeLogger::TradeLogger(const std::string& log_file) {
    log_stream_.open(log_file, std::ios::app);
}

TradeLogger::~TradeLogger() {
    if (log_stream_.is_open()) log_stream_.close();
}

void TradeLogger::log_trade(const Trade& trade) {
    std::lock_guard<std::mutex> lock(log_mutex_);
    if (!log_stream_.is_open()) return;

    log_stream_ << "TRADE|"
        << timestamp_to_string(trade.timestamp) << "|"
        << trade.trade_id << "|"
        << trade.symbol << "|"
        << std::fixed << std::setprecision(2) << trade.price << "|"
        << trade.quantity << "|"
        << trade.buy_order_id << "|"
        << trade.sell_order_id << "|"
        << trade.buyer_id << "|"
        << trade.seller_id << "\n";
    log_stream_.flush();
}

void TradeLogger::log_order(const Order& order, const std::string& action) {
    std::lock_guard<std::mutex> lock(log_mutex_);
    if (!log_stream_.is_open()) return;

    log_stream_ << "ORDER|"
        << timestamp_to_string(order.timestamp) << "|"
        << action << "|"
        << order.id << "|"
        << order.symbol << "|"
        << (order.side == OrderSide::BUY ? "BUY" : "SELL") << "|"
        << (order.type == OrderType::LIMIT ? "LIMIT" : "MARKET") << "|"
        << std::fixed << std::setprecision(2) << order.price << "|"
        << order.quantity << "|"
        << order.remaining_qty << "|"
        << order.user_id << "|"
        << static_cast<int>(order.status) << "\n";
    log_stream_.flush();
}

void TradeLogger::flush() {
    std::lock_guard<std::mutex> lock(log_mutex_);
    if (log_stream_.is_open()) log_stream_.flush();
}

std::string TradeLogger::timestamp_to_string(uint64_t timestamp_ns) {
    auto tp = std::chrono::system_clock::time_point(
        std::chrono::duration_cast<std::chrono::system_clock::duration>(
            std::chrono::nanoseconds(timestamp_ns)));
    auto time_t = std::chrono::system_clock::to_time_t(tp);

    std::stringstream ss;
    ss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%S");
    return ss.str();
}

// TradeExecutor
TradeExecutor::TradeExecutor(OrderBookManager& manager, const std::string& log_file)
    : book_manager_(manager), logger_(log_file) {}

TradeExecutor::ExecutionResult TradeExecutor::submit_order(const Order& order) {
    ExecutionResult result;
    result.success = false;
    result.filled_qty = 0;
    result.remaining_qty = order.quantity;
    result.avg_fill_price = 0.0;

    auto book = book_manager_.get_or_create_book(order.symbol);
    if (!book) {
        result.error_message = "Failed to get order book for symbol: " + order.symbol;
        return result;
    }

    // Generate order ID if not provided
    Order new_order = order;
    if (new_order.id.empty()) {
        new_order.id = generate_order_id();
    }
    result.order_id = new_order.id;

    // Log order submission
    logger_.log_order(new_order, "SUBMIT");

    // Set up trade callback to track fills
    std::vector<Trade> fills;
    book->set_trade_callback([&fills](const Trade& trade) { fills.push_back(trade); });

    // Add order to book
    if (book->add_order(new_order)) {
        auto final_order = book->get_order(new_order.id);
        result.success = true;

        // Calculate fill results
        uint32_t remaining_qty = final_order ? final_order->remaining_qty : new_order.remaining_qty;
        uint32_t total_filled = order.quantity - remaining_qty;
        if (total_filled > 0) {
            double total_value = 0.0;
            for (const auto& trade : fills) {
                total_value += trade.price * trade.quantity;
                result.trade_ids.push_back(trade.trade_id);
                result.trades.push_back(trade);
                logger_.log_trade(trade);
            }
            result.avg_fill_price = total_value / total_filled;
            result.filled_qty = total_filled;
            result.remaining_qty = remaining_qty;
        } else {
            result.remaining_qty = remaining_qty;
        }
    } else {
        result.error_message = "Failed to add order to book";
    }

    return result;
}

bool TradeExecutor::cancel_order(const std::string& symbol, const std::string& order_id) {
    auto book = book_manager_.get_book(symbol);
    if (!book) return false;

    auto order = book->get_order(order_id);
    if (order) {
        logger_.log_order(*order, "CANCEL");
    }

    return book->cancel_order(order_id);
}

std::string TradeExecutor::generate_order_id() {
    auto now = std::chrono::system_clock::now();
    auto nanos = std::chrono::duration_cast<std::chrono::nanoseconds>(
        now.time_since_epoch()).count();
    return "O" + std::to_string(++order_counter_) + "_" + std::to_string(nanos % 10000);
}

// JSON Serialization
std::string order_to_json(const Order& order) {
    std::stringstream ss;
    ss << "{";
    ss << "\"id\":\"" << order.id << "\",";
    ss << "\"symbol\":\"" << order.symbol << "\",";
    ss << "\"side\":\"" << (order.side == OrderSide::BUY ? "BUY" : "SELL") << "\",";
    ss << "\"type\":\"" << (order.type == OrderType::LIMIT ? "LIMIT" : "MARKET") << "\",";
    ss << "\"price\":" << order.price << ",";
    ss << "\"quantity\":" << order.quantity << ",";
    ss << "\"remaining_qty\":" << order.remaining_qty << ",";
    ss << "\"user_id\":\"" << order.user_id << "\",";
    ss << "\"status\":" << static_cast<int>(order.status);
    ss << "}";
    return ss.str();
}

std::string trade_to_json(const Trade& trade) {
    std::stringstream ss;
    ss << "{";
    ss << "\"trade_id\":\"" << trade.trade_id << "\",";
    ss << "\"symbol\":\"" << trade.symbol << "\",";
    ss << "\"price\":" << trade.price << ",";
    ss << "\"quantity\":" << trade.quantity << ",";
    ss << "\"buy_order_id\":\"" << trade.buy_order_id << "\",";
    ss << "\"sell_order_id\":\"" << trade.sell_order_id << "\",";
    ss << "\"buyer_id\":\"" << trade.buyer_id << "\",";
    ss << "\"seller_id\":\"" << trade.seller_id << "\",";
    ss << "\"timestamp\":" << trade.timestamp;
    ss << "}";
    return ss.str();
}

std::string order_book_to_json(const OrderBook& book, int depth) {
    std::stringstream ss;
    ss << "{";

    // Bids
    ss << "\"bids\":[";
    auto bids = book.get_bid_levels(depth);
    for (size_t i = 0; i < bids.size(); ++i) {
        ss << "{\"price\":" << bids[i].first << ",\"quantity\":" << bids[i].second << "}";
        if (i + 1 < bids.size()) ss << ",";
    }
    ss << "],";

    // Asks
    ss << "\"asks\":[";
    auto asks = book.get_ask_levels(depth);
    for (size_t i = 0; i < asks.size(); ++i) {
        ss << "{\"price\":" << asks[i].first << ",\"quantity\":" << asks[i].second << "}";
        if (i + 1 < asks.size()) ss << ",";
    }
    ss << "]";

    ss << "}";
    return ss.str();
}

} // namespace trading
