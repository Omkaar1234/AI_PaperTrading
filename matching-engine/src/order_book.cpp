#include "order_book.hpp"
#include <algorithm>
#include <fstream>
#include <iomanip>
#include <random>
#include <atomic>

namespace trading {

OrderBook::OrderBook(const std::string& symbol) : symbol_(symbol) {}

bool OrderBook::add_order(Order order) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto order_ptr = std::make_shared<Order>(order);
    order_index_[order.id] = order_ptr;

    // Process matching immediately
    if (order_ptr->side == OrderSide::BUY) {
        match_order(*order_ptr);
        if (order_ptr->type == OrderType::LIMIT && !order_ptr->is_filled()) {
            update_price_level(order_ptr->side, order_ptr->price, order_ptr->remaining_qty);
            buy_queue_.push(order_ptr.get());
        } else if (order_ptr->type == OrderType::MARKET && order_ptr->remaining_qty > 0) {
            order_ptr->status = order_ptr->remaining_qty < order_ptr->quantity
                ? OrderStatus::PARTIALLY_FILLED
                : OrderStatus::CANCELLED;
            order_ptr->remaining_qty = 0;
        }
    } else {
        match_order(*order_ptr);
        if (order_ptr->type == OrderType::LIMIT && !order_ptr->is_filled()) {
            update_price_level(order_ptr->side, order_ptr->price, order_ptr->remaining_qty);
            sell_queue_.push(order_ptr.get());
        } else if (order_ptr->type == OrderType::MARKET && order_ptr->remaining_qty > 0) {
            order_ptr->status = order_ptr->remaining_qty < order_ptr->quantity
                ? OrderStatus::PARTIALLY_FILLED
                : OrderStatus::CANCELLED;
            order_ptr->remaining_qty = 0;
        }
    }

    if (order_update_callback_) {
        order_update_callback_(*order_ptr);
    }

    return true;
}

bool OrderBook::cancel_order(const std::string& order_id) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto it = order_index_.find(order_id);
    if (it == order_index_.end()) return false;

    auto order = it->second;
    if (order->status == OrderStatus::FILLED ||
        order->status == OrderStatus::CANCELLED) {
        return false;
    }

    update_price_level(order->side, order->price, -static_cast<int32_t>(order->remaining_qty));
    order->status = OrderStatus::CANCELLED;
    order->remaining_qty = 0;
    cancelled_orders_.insert(order_id);

    if (order_update_callback_) {
        order_update_callback_(*order);
    }

    return true;
}

std::shared_ptr<Order> OrderBook::get_order(const std::string& order_id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = order_index_.find(order_id);
    if (it != order_index_.end()) return it->second;
    return nullptr;
}

void OrderBook::match_order(Order& order) {
    while (order.remaining_qty > 0) {
        Order* counter_order = nullptr;

        if (order.side == OrderSide::BUY) {
            // Look for lowest ask price
            if (sell_queue_.empty()) break;
            counter_order = sell_queue_.top();

            // Skip cancelled orders
            if (cancelled_orders_.count(counter_order->id)) {
                sell_queue_.pop();
                continue;
            }

            // Check if price crosses
            if (order.type == OrderType::LIMIT && order.price < counter_order->price) {
                break;
            }

            sell_queue_.pop();
        } else {
            // Look for highest bid price
            if (buy_queue_.empty()) break;
            counter_order = buy_queue_.top();

            if (cancelled_orders_.count(counter_order->id)) {
                buy_queue_.pop();
                continue;
            }

            if (order.type == OrderType::LIMIT && order.price > counter_order->price) {
                break;
            }

            buy_queue_.pop();
        }

        // Execute trade
        uint32_t trade_qty = std::min(order.remaining_qty, counter_order->remaining_qty);
        double trade_price = counter_order->price;

        if (order.side == OrderSide::BUY) {
            execute_trade(order, *counter_order, trade_qty, trade_price);
        } else {
            execute_trade(*counter_order, order, trade_qty, trade_price);
        }

        // Put counter order back if not filled
        if (!counter_order->is_filled()) {
            if (counter_order->side == OrderSide::BUY) {
                buy_queue_.push(counter_order);
            } else {
                sell_queue_.push(counter_order);
            }
        }
    }
}

void OrderBook::execute_trade(Order& buy_order, Order& sell_order, uint32_t qty, double price) {
    buy_order.remaining_qty -= qty;
    sell_order.remaining_qty -= qty;

    if (buy_order.is_filled()) buy_order.status = OrderStatus::FILLED;
    else buy_order.status = OrderStatus::PARTIALLY_FILLED;

    if (sell_order.is_filled()) sell_order.status = OrderStatus::FILLED;
    else sell_order.status = OrderStatus::PARTIALLY_FILLED;

    update_price_level(buy_order.side, buy_order.price, -static_cast<int32_t>(qty));
    update_price_level(sell_order.side, sell_order.price, -static_cast<int32_t>(qty));

    total_volume_traded_ += qty;

    Trade trade(generate_trade_id(), symbol_, price, qty,
                buy_order.id, sell_order.id, buy_order.user_id, sell_order.user_id);

    if (trade_callback_) {
        trade_callback_(trade);
    }

    if (order_update_callback_) {
        order_update_callback_(buy_order);
        order_update_callback_(sell_order);
    }
}

void OrderBook::update_price_level(OrderSide side, double price, int32_t qty_delta) {
    if (side == OrderSide::BUY) {
        auto it = bid_levels_.find(price);
        if (it != bid_levels_.end()) {
            int32_t new_qty = static_cast<int32_t>(it->second) + static_cast<int32_t>(qty_delta);
            if (new_qty <= 0) {
                bid_levels_.erase(it);
            } else {
                it->second = static_cast<uint32_t>(new_qty);
            }
        } else if (qty_delta > 0) {
            bid_levels_[price] = static_cast<uint32_t>(qty_delta);
        }
    } else {
        auto it = ask_levels_.find(price);
        if (it != ask_levels_.end()) {
            int32_t new_qty = static_cast<int32_t>(it->second) + static_cast<int32_t>(qty_delta);
            if (new_qty <= 0) {
                ask_levels_.erase(it);
            } else {
                it->second = static_cast<uint32_t>(new_qty);
            }
        } else if (qty_delta > 0) {
            ask_levels_[price] = static_cast<uint32_t>(qty_delta);
        }
    }
}

double OrderBook::get_best_bid() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (bid_levels_.empty()) return 0.0;
    return bid_levels_.begin()->first;
}

double OrderBook::get_best_ask() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (ask_levels_.empty()) return 0.0;
    return ask_levels_.begin()->first;
}

double OrderBook::get_spread() const {
    return get_best_ask() - get_best_bid();
}

std::vector<std::pair<double, uint32_t>> OrderBook::get_bid_levels(int depth) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::pair<double, uint32_t>> result;
    int count = 0;
    for (const auto& [price, qty] : bid_levels_) {
        result.push_back({price, qty});
        if (++count >= depth) break;
    }
    return result;
}

std::vector<std::pair<double, uint32_t>> OrderBook::get_ask_levels(int depth) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::pair<double, uint32_t>> result;
    int count = 0;
    for (const auto& [price, qty] : ask_levels_) {
        result.push_back({price, qty});
        if (++count >= depth) break;
    }
    return result;
}

std::string OrderBook::generate_trade_id() {
    static std::atomic<uint64_t> counter{0};
    return "T" + std::to_string(++counter);
}

// OrderBookManager
std::shared_ptr<OrderBook> OrderBookManager::get_or_create_book(const std::string& symbol) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = books_.find(symbol);
    if (it == books_.end()) {
        auto book = std::make_shared<OrderBook>(symbol);
        books_[symbol] = book;
        return book;
    }
    return it->second;
}

std::shared_ptr<OrderBook> OrderBookManager::get_book(const std::string& symbol) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = books_.find(symbol);
    if (it != books_.end()) return it->second;
    return nullptr;
}

std::vector<std::string> OrderBookManager::get_symbols() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> symbols;
    for (const auto& [sym, _] : books_) {
        symbols.push_back(sym);
    }
    return symbols;
}

} // namespace trading
