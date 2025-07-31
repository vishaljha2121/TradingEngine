//
// Created by Vishal Jha on 23/07/25.
//

#ifndef ORDER_BOOK_HPP
#define ORDER_BOOK_HPP
#include <list>
#include <map>
#include <unordered_map>
#pragma once
#include "order.hpp"
#include "trade.hpp"
#include "trade_log.hpp"

struct DepthSnapshot {
    std::map<double, int, std::greater<>> bids;
    std::map<double, int> asks;
};

class OrderBook {
public:
    void add_order(const Order& order);
    bool cancel_order(const std::string& order_id);
    double get_best_bid() const;
    double get_best_ask() const;
    void print_book();
    void print_depth_snapshot() const;
    void record_trade(const std::string& buy_id, const std::string& sell_id, double price, int qty);
    const TradeLog& get_trade_log() const {
        return trade_log;
    }
    DepthSnapshot get_depth_snapshot() const {
        DepthSnapshot snapshot;
        for (const auto& [price, orders] : bids) {
            int total_qty = 0;
            for (const auto& order : orders) {
                total_qty += order.quantity;
            }
            snapshot.bids[price] = total_qty;
        }
        for (const auto& [price, orders] : asks) {
            int total_qty = 0;
            for (const auto& order : orders) {
                total_qty += order.quantity;
            }
            snapshot.asks[price] = total_qty;
        }
        return snapshot;
    }
    size_t purge_expired(long now_ms);

private:
    std::map<double, std::list<Order>> bids;
    std::map<double, std::list<Order>> asks;
    std::unordered_map<std::string, std::pair<double, OrderSide>> order_index;
    TradeLog trade_log;
    int trade_counter = 0;

    void match_order(const Order& incomingOrder);
    void handle_market_order(Order &incomingOrder, OrderBook* bookPtr, std::unordered_map<std::string, std::pair<double, OrderSide>> order_index);
};

#endif //ORDER_BOOK_HPP
