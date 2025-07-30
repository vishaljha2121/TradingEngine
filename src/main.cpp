#include <iostream>
#include <chrono>  // for timestamps
#include "order_book.hpp"  // your OrderBook class header
#include "order.hpp"       // your Order class header

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

int main(int argc, char* argv[]) {
    OrderBook orderBook;

    // Prepopulate orders for demonstration (optional)
    orderBook.add_order(Order("b1", 101.0, 10, OrderSide::BUY, 123456));
    orderBook.add_order(Order("b2", 100.0, 5, OrderSide::BUY, 123457));
    orderBook.add_order(Order("s1", 102.0, 7, OrderSide::SELL, 123458));
    orderBook.add_order(Order("s2", 103.0, 3, OrderSide::SELL, 123459));

    if (argc > 1 && std::string(argv[1]) == "depth") {
        DepthSnapshot snapshot = orderBook.get_depth_snapshot();
        print_depth_snapshot(snapshot);
        return 0;
    }

    std::cout << "Usage: " << argv[0] << " depth\n";
    return 0;
}

