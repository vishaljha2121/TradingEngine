//
// Created by Vishal Jha on 26/07/25.
//

// trade_log.cpp
#include "trade_log.hpp"

void TradeLog::record_trade(const Trade& trade) {
    trades.push_back(trade);
}

const std::vector<Trade>& TradeLog::get_trades() const {
    return trades;
}
