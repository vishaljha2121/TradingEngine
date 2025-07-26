//
// Created by Vishal Jha on 25/07/25.
//

#ifndef TRADE_HPP
#define TRADE_HPP


#pragma once
#include <string>

struct Trade {
    std::string trade_id;
    std::string buy_order_id;
    std::string sell_order_id;
    double price;
    int quantity;
    long timestamp;

    Trade(const std::string& id,
          const std::string& buy_id,
          const std::string& sell_id,
          double price,
          int qty,
          long timestamp);
};

#endif //TRADE_HPP
