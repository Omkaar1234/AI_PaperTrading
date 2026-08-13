#include "network_server.hpp"
#include <sstream>
#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include <algorithm>

namespace trading {

NetworkServer::NetworkServer(OrderBookManager& manager, int port)
    : book_manager_(manager), port_(port) {
    executor_ = std::make_unique<TradeExecutor>(manager, "trades.log");
}

NetworkServer::~NetworkServer() {
    stop();
}

bool NetworkServer::start() {
#ifdef _WIN32
    if (WSAStartup(MAKEWORD(2, 2), &wsa_data_) != 0) {
        std::cerr << "WSAStartup failed\n";
        return false;
    }
#endif

    server_socket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (server_socket_ == INVALID_SOCKET) {
        std::cerr << "Failed to create socket\n";
        return false;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(server_socket_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(server_socket_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port_);

    if (bind(server_socket_, (struct sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        std::cerr << "Failed to bind socket to port " << port_ << "\n";
        closesocket(server_socket_);
        return false;
    }

    if (listen(server_socket_, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "Failed to listen on socket\n";
        closesocket(server_socket_);
        return false;
    }

    running_ = true;
    accept_thread_ = std::thread(&NetworkServer::accept_connections, this);

    std::cout << "Matching Engine listening on port " << port_ << std::endl;
    return true;
}

void NetworkServer::stop() {
    running_ = false;

    if (server_socket_ != INVALID_SOCKET) {
        closesocket(server_socket_);
        server_socket_ = INVALID_SOCKET;
    }

    if (accept_thread_.joinable()) {
        accept_thread_.join();
    }

#ifdef _WIN32
    WSACleanup();
#endif
}

void NetworkServer::accept_connections() {
    while (running_) {
        sockaddr_in client_addr{};
        #ifdef _WIN32
            int addr_len = sizeof(client_addr);
        #else
            socklen_t addr_len = sizeof(client_addr);
        #endif

        SOCKET client_socket = accept(server_socket_, (struct sockaddr*)&client_addr, &addr_len);
        if (client_socket == INVALID_SOCKET) {
            if (running_) {
                std::cerr << "Failed to accept connection\n";
            }
            continue;
        }

        std::thread(&NetworkServer::handle_client, this, client_socket).detach();
    }
}

void NetworkServer::handle_client(SOCKET client_socket) {
    char buffer[4096];
    std::string accumulated;

    while (running_) {
        int received = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
        if (received <= 0) break;

        buffer[received] = '\0';
        accumulated += buffer;

        // Process complete messages (newline delimited)
        size_t pos;
        while ((pos = accumulated.find('\n')) != std::string::npos) {
            std::string message = accumulated.substr(0, pos);
            accumulated.erase(0, pos + 1);

            std::string response = process_message(message);
            if (!send_response(client_socket, response + "\n")) {
                break;
            }
        }
    }

    closesocket(client_socket);
}

std::string NetworkServer::process_message(const std::string& message) {
    // Parse command and parameters
    size_t delim = message.find('|');
    std::string command = (delim != std::string::npos) ? message.substr(0, delim) : message;
    std::string params = (delim != std::string::npos) ? message.substr(delim + 1) : "";

    if (command == "PLACE_ORDER") {
        return handle_place_order(params);
    } else if (command == "CANCEL_ORDER") {
        return handle_cancel_order(params);
    } else if (command == "GET_BOOK") {
        return handle_get_order_book(params);
    } else if (command == "GET_ORDER") {
        return handle_get_order(params);
    } else if (command == "PING") {
        return "PONG|OK";
    }

    return "ERROR|Unknown command: " + command;
}

std::string NetworkServer::handle_place_order(const std::string& params) {
    // Parse: symbol|side|type|price|quantity|user_id
    std::vector<std::string> parts;
    std::stringstream ss(params);
    std::string part;
    while (std::getline(ss, part, '|')) {
        parts.push_back(part);
    }

    if (parts.size() < 6) {
        return "ERROR|Invalid parameters for PLACE_ORDER";
    }

    Order order;
    order.symbol = parts[0];
    order.side = (parts[1] == "BUY") ? OrderSide::BUY : OrderSide::SELL;
    order.type = (parts[2] == "LIMIT") ? OrderType::LIMIT : OrderType::MARKET;
    order.price = std::stod(parts[3]);
    order.quantity = std::stoul(parts[4]);
    order.remaining_qty = order.quantity;
    order.user_id = parts[5];
    order.status = OrderStatus::PENDING;
    order.timestamp = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::high_resolution_clock::now().time_since_epoch()).count();

    auto result = executor_->submit_order(order);

    if (result.success) {
        record_trades(result.trades);
        std::stringstream response;
        response << "SUCCESS|" << result.order_id << "|"
               << result.filled_qty << "|"
               << result.remaining_qty << "|"
               << std::fixed << std::setprecision(2) << result.avg_fill_price << "|[";
        for (size_t index = 0; index < result.trades.size(); ++index) {
            response << trade_to_json(result.trades[index]);
            if (index + 1 < result.trades.size()) {
                response << ",";
            }
        }
        response << "]";
        return response.str();
    }

    return "ERROR|" + result.error_message;
}

std::string NetworkServer::handle_cancel_order(const std::string& params) {
    std::vector<std::string> parts;
    std::stringstream ss(params);
    std::string part;
    while (std::getline(ss, part, '|')) {
        parts.push_back(part);
    }

    if (parts.size() < 2) {
        return "ERROR|Invalid parameters for CANCEL_ORDER";
    }

    std::string symbol = parts[0];
    std::string order_id = parts[1];

    if (executor_->cancel_order(symbol, order_id)) {
        return "SUCCESS|Order cancelled";
    }

    return "ERROR|Failed to cancel order";
}

std::string NetworkServer::handle_get_order_book(const std::string& params) {
    auto book = book_manager_.get_book(params);
    if (!book) {
        return "BOOK|{\"bids\":[],\"asks\":[]}";
    }
    return "BOOK|" + order_book_to_json(*book);
}

std::string NetworkServer::handle_get_order(const std::string& params) {
    std::vector<std::string> parts;
    std::stringstream ss(params);
    std::string part;
    while (std::getline(ss, part, '|')) {
        parts.push_back(part);
    }

    if (parts.size() < 2) {
        return "ERROR|Invalid parameters";
    }

    auto book = book_manager_.get_book(parts[0]);
    if (!book) return "ORDER|null";

    auto order = book->get_order(parts[1]);
    if (!order) return "ORDER|null";

    return "ORDER|" + order_to_json(*order);
}

std::string NetworkServer::handle_get_trades(const std::string& params) {
    std::lock_guard<std::mutex> lock(trades_mutex_);
    std::stringstream response;
    response << "TRADES|[";

    bool first = true;
    for (const auto& trade : recent_trades_) {
        if (!params.empty() && trade.symbol != params) {
            continue;
        }
        if (!first) {
            response << ",";
        }
        response << trade_to_json(trade);
        first = false;
    }

    response << "]";
    return response.str();
}

bool NetworkServer::send_response(SOCKET client_socket, const std::string& response) {
    int sent = send(client_socket, response.c_str(), static_cast<int>(response.length()), 0);
    return sent == static_cast<int>(response.length());
}

void NetworkServer::record_trades(const std::vector<Trade>& trades) {
    if (trades.empty()) {
        return;
    }

    std::lock_guard<std::mutex> lock(trades_mutex_);
    for (const auto& trade : trades) {
        recent_trades_.push_back(trade);
    }

    constexpr size_t max_recent_trades = 500;
    while (recent_trades_.size() > max_recent_trades) {
        recent_trades_.pop_front();
    }
}

} // namespace trading
