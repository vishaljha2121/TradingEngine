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


class OrderBook {
public:
    void add_order(const Order& order);
    void cancel_order(const std::string& order_id);
    double get_best_bid() const;
    double get_best_ask() const;
    void print_book();

private:
    std::map<double, std::list<Order>> bids;
    std::map<double, std::list<Order>> asks;
    std::unordered_map<std::string, std::pair<double, OrderSide>> order_index;

    void match_order(const Order& order);
};

#endif //ORDER_BOOK_HPP
