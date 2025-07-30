//
// Created by Vishal Jha on 25/07/25.
//

#include <gtest/gtest.h>
#include "order_book.hpp"
#include "trade_log.hpp"

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

TEST(OrderBookTest, LimitOrderMatching) {
    OrderBook ob;
    Order sellOrder("s1", 100.0, 10, OrderSide::SELL, 1234);
    Order buyOrder("b1", 100.0, 10, OrderSide::BUY, 1235);

    ob.add_order(sellOrder);
    ob.add_order(buyOrder);

    // Both should match and book should be empty
    EXPECT_EQ(ob.get_best_bid(), 0.0);
    EXPECT_EQ(ob.get_best_ask(), 0.0);

    const auto& trades = ob.get_trade_log().get_trades();
    EXPECT_EQ(trades.size(), 1);
    EXPECT_EQ(trades[0].buy_order_id, "b1");
    EXPECT_EQ(trades[0].sell_order_id, "s1");
    EXPECT_DOUBLE_EQ(trades[0].price, 100.0);
    EXPECT_EQ(trades[0].quantity, 10);
}

TEST(OrderBookTest, MarketOrderMatching) {
    OrderBook ob;
    Order sellOrder("s1", 100.0, 10, OrderSide::SELL, 1234);
    ob.add_order(sellOrder);

    Order marketBuy("b1", 0.0, 10, OrderSide::BUY, 1235, OrderType::MARKET);
    ob.add_order(marketBuy);

    const auto &trades = ob.get_trade_log().get_trades();
    ASSERT_EQ(trades.size(), 1);
    EXPECT_EQ(trades[0].price, 100.0);
    EXPECT_EQ(trades[0].quantity, 10);
    EXPECT_EQ(trades[0].buy_order_id, "b1");
    EXPECT_EQ(trades[0].sell_order_id, "s1");

    EXPECT_EQ(ob.get_best_ask(), 0.0);  // No ask left
    EXPECT_EQ(ob.get_best_bid(), 0.0);  // No bid left
}

TEST(OrderBookTest, PartialFillLeavesRemaining) {
    OrderBook ob;
    Order sellOrder("s1", 100.0, 5, OrderSide::SELL, 1234);
    Order buyOrder("b1", 100.0, 10, OrderSide::BUY, 1235);

    ob.add_order(sellOrder);
    ob.add_order(buyOrder);

    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 100.0);  // Remaining buy order
    EXPECT_EQ(ob.get_best_ask(), 0.0);

    const auto &trades = ob.get_trade_log().get_trades();
    ASSERT_EQ(trades.size(), 1);
    EXPECT_EQ(trades[0].quantity, 5);
}

TEST(OrderBookTest, DepthSnapshotCorrectness) {
    OrderBook ob;
    ob.add_order(Order("b1", 99.0, 10, OrderSide::BUY, 1000));
    ob.add_order(Order("b2", 100.0, 5, OrderSide::BUY, 1001));
    ob.add_order(Order("s1", 101.0, 7, OrderSide::SELL, 1002));
    ob.add_order(Order("s2", 102.0, 3, OrderSide::SELL, 1003));

    auto snapshot = ob.get_depth_snapshot();
    EXPECT_EQ(snapshot.bids[100.0], 5);
    EXPECT_EQ(snapshot.bids[99.0], 10);
    EXPECT_EQ(snapshot.asks[101.0], 7);
    EXPECT_EQ(snapshot.asks[102.0], 3);
}

