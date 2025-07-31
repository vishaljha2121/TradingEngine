#include <iostream>
#include <chrono>
#include <sstream>
#include "order_book.hpp"
#include "order.hpp"
#include "cli_utils.hpp"

void print_depth_snapshot(const DepthSnapshot& snapshot) {
    std::cout << "Bids:\n";
    for (const auto& [price, quantity] : snapshot.bids) {
        std::cout << "Price: " << price << ", Quantity: " << quantity << "\n";
    }

    std::cout << "Asks:\n";
    for (const auto& [price, quantity] : snapshot.asks) {
        std::cout << "Price: " << price << ", Quantity: " << quantity << "\n";
    }
}


int main()
{
    OrderBook orderBook;
    std::string line;
    std::cout << "TradingEngine CLI — type 'help' for commands\n";

    while (std::getline(std::cin, line)) {
        long now_ms = current_timestamp();
        orderBook.purge_expired(now_ms);
        std::istringstream ss(line);
        std::string cmd; ss >> cmd;
        if (cmd == "add_limit") {
            std::string side; double price; int qty;
            std::string token;
            std::optional<long> exp = std::nullopt;
            if (!(ss >> side >> price >> qty)) { std::cout << "syntax\n"; continue; }
            while (ss >> token) {
                if (token.rfind("ttl=",0) == 0) {                // ttl=SECONDS
                    int ttl_s = std::stoi(token.substr(4));
                    exp = now_ms + ttl_s*1000L;
                } else if (token.rfind("exp=",0) == 0) {         // exp=ABS_EPOCH_MS
                    exp = std::stol(token.substr(4));
                }
            }
            std::string id = generate_id();
            Order o(id, price, qty,
                    (side == "buy") ? OrderSide::BUY : OrderSide::SELL,
                    current_timestamp(), exp);
            orderBook.add_order(o);
            std::cout << "OK id=" << id << '\n';
        }
        else if (cmd == "add_market") {
            std::string side; int qty;
            if (!(ss >> side >> qty)) { std::cout << "syntax\n"; continue; }
            std::string id = generate_id();
            Order o(id, 0.0, qty,
                    (side == "buy") ? OrderSide::BUY : OrderSide::SELL,
                    current_timestamp(),
                    OrderType::MARKET);
            orderBook.add_order(o);
            std::cout << "OK id=" << id << '\n';
        }
        else if (cmd == "cancel") {
            std::string id; ss >> id;
            bool ok = orderBook.cancel_order(id);
            std::cout << (ok ? "Cancelled\n" : "Not found / inactive\n");
        }
        else if (cmd == "print_depth")  orderBook.print_book();
        else if (cmd == "print_orders") print_orders(orderBook);
        else if (cmd == "print_trades") print_trades(orderBook.get_trade_log());
        else if (cmd == "help")         print_help();
        else if (cmd == "quit" || cmd == "exit" || cmd == "q") break;
        else std::cout << "Unknown command — type 'help'\n";
    }
}

