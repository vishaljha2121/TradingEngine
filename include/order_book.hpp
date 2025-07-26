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


class OrderBook {
public:
    void add_order(const Order& order);
    void cancel_order(const std::string& order_id);
    double get_best_bid() const;
    double get_best_ask() const;
    void print_book();
    void record_trade(const std::string& buy_id, const std::string& sell_id, double price, int qty);

private:
    std::map<double, std::list<Order>> bids;
    std::map<double, std::list<Order>> asks;
    std::unordered_map<std::string, std::pair<double, OrderSide>> order_index;
    std::vector<Trade> trade_log;
    int trade_counter = 0;

    void match_order(const Order& incomingOrder);
    void handle_market_order(Order &incomingOrder);
};

#endif //ORDER_BOOK_HPP
