#include <iostream>
#include "order.hpp"
#include "order_book.hpp"

int main() {
    OrderBook ob;

    ob.add_order(Order("A1", 100.0, 10, OrderSide::BUY, 1));
    ob.add_order(Order("A2", 99.0, 5, OrderSide::BUY, 2));
    ob.add_order(Order("B1", 101.0, 7, OrderSide::SELL, 3));
    ob.add_order(Order("B2", 98.0, 2, OrderSide::SELL, 4));

    ob.print_book();
    return 0;
}
