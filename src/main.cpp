#include <iostream>
#include <chrono>  // for timestamps
#include "order_book.hpp"  // your OrderBook class header
#include "order.hpp"       // your Order class header

int main() {
    OrderBook ob;

    // Utility to get a current timestamp - you can customize as needed
    auto now = []() -> long {
        return std::chrono::system_clock::now().time_since_epoch() / std::chrono::milliseconds(1);
    };

    // Add some buy orders
    ob.add_order(Order("b1", 100.0, 10, OrderSide::BUY, now()));
    ob.add_order(Order("b2", 101.0, 5, OrderSide::BUY, now()));
    ob.add_order(Order("b3", 99.0, 15, OrderSide::BUY, now()));

    // Add some sell orders
    ob.add_order(Order("s1", 102.0, 10, OrderSide::SELL, now()));
    ob.add_order(Order("s2", 99.0, 8, OrderSide::SELL, now()));
    ob.add_order(Order("s3", 101.0, 12, OrderSide::SELL, now()));

    std::cout << "Initial order book:\n";
    ob.print_book();

    std::cout << "\nAdding a buy order that triggers matches:\n";

    ob.add_order(Order("b4", 101.0, 20, OrderSide::BUY, now()));

    ob.print_book();

    std::cout << "\nCancel order 's1' (sell order at 102):\n";

    ob.cancel_order("s1");

    ob.print_book();

    return 0;
}
