#pragma once

#include "order_book.hpp"
#include "trade_executor.hpp"
#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <deque>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif

namespace trading {

class NetworkServer {
public:
    NetworkServer(OrderBookManager& manager, int port);
    ~NetworkServer();

    bool start();
    void stop();
    bool is_running() const { return running_.load(); }

private:
    void accept_connections();
    void handle_client(SOCKET client_socket);
    std::string process_message(const std::string& message);
    bool send_response(SOCKET client_socket, const std::string& response);
    void record_trades(const std::vector<Trade>& trades);

    // Command handlers
    std::string handle_place_order(const std::string& params);
    std::string handle_cancel_order(const std::string& params);
    std::string handle_get_order_book(const std::string& params);
    std::string handle_get_order(const std::string& params);
    std::string handle_get_trades(const std::string& params);

    OrderBookManager& book_manager_;
    std::unique_ptr<TradeExecutor> executor_;

    int port_;
    SOCKET server_socket_ = INVALID_SOCKET;
    std::atomic<bool> running_{false};
    std::thread accept_thread_;
    std::deque<Trade> recent_trades_;
    mutable std::mutex trades_mutex_;

#ifdef _WIN32
    WSADATA wsa_data_;
#endif
};

} // namespace trading
