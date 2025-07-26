//
// Created by Vishal Jha on 25/07/25.
//

#include "trade.hpp"

Trade::Trade(const std::string& id,
             const std::string& buy_id,
             const std::string& sell_id,
             double price,
             int qty,
             long timestamp)
    : trade_id(id),
      buy_order_id(buy_id),
      sell_order_id(sell_id),
      price(price),
      quantity(qty),
      timestamp(timestamp) {}
