//
// Created by Vishal Jha on 25/07/25.
//

#include <gtest/gtest.h>

#include "cli_utils.hpp"
#include "json.hpp"
#include "order_book.hpp"
#include "trade_log.hpp"

class OrderBookTest : public ::testing::Test {
protected:
    OrderBook ob;
};

TEST(OrderBookTest, AddBuyOrder) {
    OrderBook ob;
    Order o("b1", 100.0, 10, OrderSide::BUY, 123456, std::nullopt);
    ob.add_order(o);

    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 100.0);
}

TEST(OrderBookTest, AddSellOrder) {
    OrderBook ob;
    Order o("s1", 105.0, 10, OrderSide::SELL, 123456, std::nullopt);
    ob.add_order(o);

    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 105.0);
}

TEST(OrderBookTest, LimitOrderMatching) {
    OrderBook ob;
    Order sellOrder("s1", 100.0, 10, OrderSide::SELL, 1234, std::nullopt);
    Order buyOrder("b1", 100.0, 10, OrderSide::BUY, 1235, std::nullopt);

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
    Order sellOrder("s1", 100.0, 10, OrderSide::SELL, 1234, std::nullopt);
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
    Order sellOrder("s1", 100.0, 5, OrderSide::SELL, 1234, std::nullopt);
    Order buyOrder("b1", 100.0, 10, OrderSide::BUY, 1235, std::nullopt);

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
    ob.add_order(Order("b1", 99.0, 10, OrderSide::BUY, 1000, std::nullopt));
    ob.add_order(Order("b2", 100.0, 5, OrderSide::BUY, 1001, std::nullopt));
    ob.add_order(Order("s1", 101.0, 7, OrderSide::SELL, 1002, std::nullopt));
    ob.add_order(Order("s2", 102.0, 3, OrderSide::SELL, 1003, std::nullopt));

    auto snapshot = ob.get_depth_snapshot();
    EXPECT_EQ(snapshot.bids[100.0], 5);
    EXPECT_EQ(snapshot.bids[99.0], 10);
    EXPECT_EQ(snapshot.asks[101.0], 7);
    EXPECT_EQ(snapshot.asks[102.0], 3);
}

TEST(OrderBookTest, CancelOpenOrder) {
    OrderBook ob;
    Order o("b1", 100.0, 10, OrderSide::BUY, 111, 2);
    ob.add_order(o);

    EXPECT_TRUE(ob.cancel_order("b1"));          // should succeed
    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 0.0);    // order book empty
    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 0.0);

    auto snap = ob.get_depth_snapshot();
    EXPECT_EQ(snap.bids.count(100.0), 0);        // price level removed
}

TEST(OrderBookTest, CancelNonExistentOrder) {
    OrderBook ob;
    EXPECT_FALSE(ob.cancel_order("ghost"));      // nothing to cancel
    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 0.0);
    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 0.0);
}

TEST(OrderBookTest, CancelAlreadyFilledOrder) {
    OrderBook ob;
    Order s("s1", 100.0, 10, OrderSide::SELL, 1, std::nullopt);
    Order b("b1", 100.0, 10, OrderSide::BUY , 2, std::nullopt);
    ob.add_order(s);
    ob.add_order(b);                             // matches & fills

    EXPECT_FALSE(ob.cancel_order("b1"));         // cannot cancel filled order

    const auto& trades = ob.get_trade_log().get_trades();
    EXPECT_EQ(trades.size(), 1);                 // one trade recorded
}

TEST(OrderBookTest, CancelPartiallyFilledOrder) {
    OrderBook ob;
    ob.add_order(Order("s1", 100.0, 5 , OrderSide::SELL, 1, std::nullopt));
    ob.add_order(Order("b1", 100.0, 10, OrderSide::BUY , 2, std::nullopt));  // 5 filled, 5 remain

    EXPECT_TRUE(ob.cancel_order("b1"));          // cancel remaining 5

    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 0.0);
    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 0.0);

    const auto& trades = ob.get_trade_log().get_trades();
    ASSERT_EQ(trades.size(), 1);
    EXPECT_EQ(trades[0].quantity, 5);            // only partial trade logged
}

TEST(OrderBookTest, CancelRemovesEmptyPriceLevel) {
    OrderBook ob;
    ob.add_order(Order("b1",  99.0, 10, OrderSide::BUY, 1, std::nullopt));
    ob.add_order(Order("b2", 100.0,  5, OrderSide::BUY, 2, std::nullopt));

    EXPECT_TRUE(ob.cancel_order("b1"));          // remove sole order at 99

    auto snap = ob.get_depth_snapshot();
    EXPECT_EQ(snap.bids.count(99.0) , 0);        // 99 price level gone
    EXPECT_EQ(snap.bids[100.0]      , 5);        // 100 remains
}

TEST(OrderBookTest, OrderExpiresAndIsRemoved) {
    OrderBook ob;
    long now_ms  = current_timestamp();
    long exp_ms  = now_ms + 100;                    // TTL = 100 ms

    // Add BUY limit order that will expire in 100 ms
    Order o("b1", 100.0, 10, OrderSide::BUY, now_ms, exp_ms);
    ob.add_order(o);

    // Before expiry it is the best bid
    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 100.0);

    // Advance time past expiry and purge
    size_t purged = ob.purge_expired(exp_ms + 1);
    EXPECT_EQ(purged, 1u);                          // exactly one removed

    // Order book should now be empty on bid side
    EXPECT_DOUBLE_EQ(ob.get_best_bid(), 0.0);

    // Attempting to cancel should fail (already expired)
    EXPECT_FALSE(ob.cancel_order("b1"));
}

TEST(OrderBookTest, ExpiredOrderDoesNotTradeLater) {
    OrderBook ob;
    long now_ms = current_timestamp();

    // BUY order that expires very soon
    Order buy("b1", 100.0, 10, OrderSide::BUY, now_ms, now_ms + 50);
    ob.add_order(buy);

    // Fast-forward beyond expiry
    ob.purge_expired(now_ms + 100);

    // Now submit a SELL order at the same price
    Order sell("s1", 100.0, 10, OrderSide::SELL, now_ms + 100, std::nullopt);
    ob.add_order(sell);

    // No trade should have occurred because buy order was gone
    const auto& trades = ob.get_trade_log().get_trades();
    EXPECT_EQ(trades.size(), 0u);

    // Only the sell order should be resting as best ask
    EXPECT_DOUBLE_EQ(ob.get_best_ask(), 100.0);
    EXPECT_DOUBLE_EQ(ob.get_best_bid(),  0.0);
}

TEST(OrderBookTest, CancelExpiredOrderFails) {
    OrderBook ob;
    long now_ms = current_timestamp();

    Order o("b1", 101.0, 5, OrderSide::BUY, now_ms, now_ms + 10);
    ob.add_order(o);

    // Let it expire
    ob.purge_expired(now_ms + 20);

    // cancel_order should return false because status is Expired
    EXPECT_FALSE(ob.cancel_order("b1"));

    // Depth snapshot must show no active orders
    auto snap = ob.get_depth_snapshot();
    EXPECT_TRUE(snap.bids.empty());
    EXPECT_TRUE(snap.asks.empty());
}

TEST(OrderBookTest, SnapshotPersistence) {
    using namespace std;
    using namespace std::filesystem;

    OrderBook ob;

    // Add BUY order
    Order o1("id1", 100.0, 10, OrderSide::BUY, current_timestamp(), std::nullopt);
    ob.add_order(o1);

    // Add SELL order
    Order o2("id2", 105.0, 5, OrderSide::SELL, current_timestamp(), std::nullopt);
    ob.add_order(o2);

    // Save snapshot
    std::string snapshot_file = "../snapshots/test_snapshot.json";
    ob.save_snapshot(snapshot_file);

    ASSERT_TRUE(std::filesystem::exists(snapshot_file)) << "Snapshot file was not created.";

    // Capture original depth snapshot
    DepthSnapshot before = ob.get_depth_snapshot();

    // Clear book by constructing a new one
    OrderBook ob_restored;
    ob_restored.load_snapshot(snapshot_file);

    // Capture restored snapshot
    DepthSnapshot after = ob_restored.get_depth_snapshot();

    // Check bids
    ASSERT_EQ(before.bids.size(), after.bids.size());
    for (const auto& [price, qty] : before.bids) {
        ASSERT_EQ(after.bids.at(price), qty);
    }

    // Check asks
    ASSERT_EQ(before.asks.size(), after.asks.size());
    for (const auto& [price, qty] : before.asks) {
        ASSERT_EQ(after.asks.at(price), qty);
    }

    // Clean up
    std::filesystem::remove(snapshot_file);
}

TEST(OrderBookTest, LoadFromNonExistentFile) {
    OrderBook book;
    bool success = book.load_snapshot("data/does_not_exist.json");
    ASSERT_FALSE(success);
}

TEST(OrderBookTest, LoadFromMalformedFile) {
    const std::string filepath = "../snapshots/malformed_snapshot.json";

    // Write invalid JSON to file
    std::ofstream out(filepath);
    out << "{ this is not valid json ";
    out.close();

    OrderBook book;
    bool success = book.load_snapshot(filepath);
    ASSERT_FALSE(success);

    // Clean up
    std::filesystem::remove(filepath);
}

TEST(OrderBookTest, LoadSnapshotThenPurgeExpiredOrders) {
    OrderBook ob;

    long now = current_timestamp();
    long past = now - 10000; // 10 seconds ago
    long future = now + 60000; // 60 seconds in the future

    Order expired("expired", 100.0, 10, OrderSide::BUY, past - 10000, past);
    Order valid("valid", 100.0, 20, OrderSide::BUY, now, future);

    ob.add_order(expired);
    ob.add_order(valid);

    ob.save_snapshot("../snapshots/temp_snapshot_expiry.json");

    OrderBook loaded;
    loaded.load_snapshot("../snapshots/temp_snapshot_expiry.json");

    loaded.purge_expired(now);

    auto bids = loaded.get_bids();
    ASSERT_EQ(bids.size(), 1);
    EXPECT_EQ(bids.begin()->second.front().order_id, "valid");

    // Clean up
    std::filesystem::remove("../snapshots/temp_snapshot_expiry.json");
}

TEST (OrderBookTest, SaveSnapshotSkipsInactiveOrders) {
    OrderBook ob;

    Order active("active", 100.0, 10, OrderSide::BUY, current_timestamp(), std::nullopt);
    Order inactive("inactive", 101.0, 5, OrderSide::BUY, current_timestamp(), std::nullopt);

    ob.add_order(active);
    ob.add_order(inactive);
    ob.cancel_order("inactive");

    ob.save_snapshot("../snapshots/temp_snapshot_expiry.json");

    std::ifstream in("../snapshots/temp_snapshot_expiry.json");
    nlohmann::json j;
    in >> j;

    for (const auto& entry : j) {
        EXPECT_NE(entry["id"], "inactive");
    }

    // Clean up
    std::filesystem::remove("../snapshots/temp_snapshot_expiry.json");
}

TEST(OrderBookTest, SaveLoadEmptySnapshot) {
    OrderBook ob;
    ob.save_snapshot("../snapshots/temp_snapshot_expiry.json");

    OrderBook loaded;
    EXPECT_NO_THROW(loaded.load_snapshot("../snapshots/temp_snapshot_expiry.json"));

    EXPECT_TRUE(loaded.get_bids().empty());
    EXPECT_TRUE(loaded.get_asks().empty());
}

TEST(OrderBookTest, LoadSnapshotPreservesOrderFields) {
    OrderBook ob;

    Order o1("A1", 99.5, 15, OrderSide::SELL, current_timestamp(), current_timestamp() + 10000);
    ob.add_order(o1);
    ob.save_snapshot("../snapshots/temp_snapshot_expiry.json");

    OrderBook loaded;
    loaded.load_snapshot("../snapshots/temp_snapshot_expiry.json");

    auto asks = loaded.get_asks();
    ASSERT_EQ(asks.size(), 1);
    const auto& loaded_order = asks.begin()->second.front();

    EXPECT_EQ(loaded_order.order_id, "A1");
    EXPECT_EQ(loaded_order.price, 99.5);
    EXPECT_EQ(loaded_order.quantity, 15);
    EXPECT_EQ(loaded_order.side, OrderSide::SELL);
    EXPECT_TRUE(loaded_order.expiry_ms.has_value());

    // Clean up
    std::filesystem::remove("../snapshots/temp_snapshot_expiry.json");
}
