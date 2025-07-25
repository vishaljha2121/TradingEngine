//
// Created by Vishal Jha on 25/07/25.
//

#include <gtest/gtest.h>
#include "order.hpp"

TEST(OrderTest, ConstructorInitialization) {
    Order o("o1", 100.0, 10, OrderSide::BUY, 123456);

    EXPECT_EQ(o.order_id, "o1");
    EXPECT_EQ(o.price, 100.0);
    EXPECT_EQ(o.quantity, 10);
    EXPECT_EQ(o.side, OrderSide::BUY);
    EXPECT_EQ(o.timestamp, 123456);
    EXPECT_TRUE(o.is_active);
}
