//
// Created by Vishal Jha on 25/07/25.
//

#include <gtest/gtest.h>
#include "order_book.hpp"

TEST(OrderBookTest, AddBuyOrder) {
    OrderBook ob;
    Order o("b1", 100.0, 10, OrderSide::BUY, 123456);
    ob.add_order(o);

    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 100.0);
}

TEST(OrderBookTest, AddSellOrder) {
    OrderBook ob;
    Order o("s1", 105.0, 10, OrderSide::SELL, 123456);
    ob.add_order(o);

    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 105.0);
}
