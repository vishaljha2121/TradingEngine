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
    OrderBook ob;
    std::string line;
    std::cout << "TradingEngine CLI — type 'help' for commands\n";

    while (std::getline(std::cin, line)) {
        std::istringstream ss(line);
        std::string cmd; ss >> cmd;
        if (cmd == "add_limit") {
            std::string side; double price; int qty;
            if (!(ss >> side >> price >> qty)) { std::cout << "syntax\n"; continue; }
            std::string id = generate_id();
            Order o(id, price, qty,
                    (side == "buy") ? OrderSide::BUY : OrderSide::SELL,
                    current_timestamp());
            ob.add_order(o);
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
            ob.add_order(o);
            std::cout << "OK id=" << id << '\n';
        }
        else if (cmd == "cancel") {
            std::string id; ss >> id;
            bool ok = ob.cancel_order(id);
            std::cout << (ok ? "Cancelled\n" : "Not found / inactive\n");
        }
        else if (cmd == "print_depth")  ob.print_book();
        else if (cmd == "print_orders") print_orders(ob);
        else if (cmd == "print_trades") print_trades(ob.get_trade_log());
        else if (cmd == "help")         print_help();
        else if (cmd == "quit" || cmd == "exit" || cmd == "q") break;
        else std::cout << "Unknown command — type 'help'\n";
    }
}

