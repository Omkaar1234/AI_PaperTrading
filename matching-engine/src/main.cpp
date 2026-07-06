#include "network_server.hpp"
#include <iostream>
#include <csignal>
#include <cstdlib>

std::unique_ptr<trading::NetworkServer> g_server;

void signal_handler(int signal) {
    std::cout << "\nShutting down matching engine...\n";
    if (g_server) {
        g_server->stop();
    }
    exit(0);
}

int main(int argc, char* argv[]) {
    int port = 9000;

    if (argc > 1) {
        port = std::atoi(argv[1]);
    }

    // Set up signal handlers
    signal(SIGINT, signal_handler);
#ifndef _WIN32
    signal(SIGTERM, signal_handler);
#endif

    std::cout << "====================================\n";
    std::cout << "  AI Trading - Matching Engine\n";
    std::cout << "  Version 1.0.0\n";
    std::cout << "====================================\n\n";

    trading::OrderBookManager manager;
    g_server = std::make_unique<trading::NetworkServer>(manager, port);

    if (!g_server->start()) {
        std::cerr << "Failed to start server\n";
        return 1;
    }

    std::cout << "\nPress Ctrl+C to stop the server\n\n";

    // Keep main thread alive
    while (g_server->is_running()) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    return 0;
}
