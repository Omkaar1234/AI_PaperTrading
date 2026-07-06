#pragma once

#include <string>
#include <chrono>
#include <cstdint>
#include <limits>

namespace trading {

enum class OrderSide { BUY, SELL };
enum class OrderType { LIMIT, MARKET };
enum class OrderStatus { PENDING, PARTIALLY_FILLED, FILLED, CANCELLED };

struct Order {
    std::string id;
    std::string symbol;
    OrderSide side;
    OrderType type;
    double price;
    uint32_t quantity;
    uint32_t remaining_qty;
    uint64_t timestamp;
    std::string user_id;
    OrderStatus status;

    Order() = default;

    Order(const std::string& order_id, const std::string& sym,
          OrderSide s, OrderType t, double p, uint32_t qty,
          const std::string& user)
        : id(order_id), symbol(sym), side(s), type(t), price(p),
          quantity(qty), remaining_qty(qty), user_id(user),
          status(OrderStatus::PENDING) {
        timestamp = std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::high_resolution_clock::now().time_since_epoch()).count();
    }

    bool is_buy() const { return side == OrderSide::BUY; }
    bool is_sell() const { return side == OrderSide::SELL; }
    bool is_filled() const { return remaining_qty == 0; }

    double get_fill_price() const {
        if (type == OrderType::MARKET) {
            return (side == OrderSide::BUY) ?
                   std::numeric_limits<double>::max() :
                   std::numeric_limits<double>::min();
        }
        return price;
    }
};

struct Trade {
    std::string trade_id;
    std::string symbol;
    double price;
    uint32_t quantity;
    std::string buy_order_id;
    std::string sell_order_id;
    std::string buyer_id;
    std::string seller_id;
    uint64_t timestamp;

    Trade(const std::string& tid, const std::string& sym, double p, uint32_t qty,
          const std::string& buy_id, const std::string& sell_id,
          const std::string& buyer, const std::string& seller)
        : trade_id(tid), symbol(sym), price(p), quantity(qty),
          buy_order_id(buy_id), sell_order_id(sell_id),
          buyer_id(buyer), seller_id(seller) {
        timestamp = std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::high_resolution_clock::now().time_since_epoch()).count();
    }
};

} // namespace trading
