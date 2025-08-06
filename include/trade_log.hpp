//
// Created by Vishal Jha on 26/07/25.
//

// trade_log.hpp
#ifndef TRADE_LOG_HPP
#define TRADE_LOG_HPP

#include <fstream>
#include "trade.hpp"
#include <vector>

class TradeLog {
private:
    std::vector<Trade> trades_;
    std::ofstream       file_;

public:
    TradeLog();
    ~TradeLog();
    void record_trade(const Trade& trade);
    const std::vector<Trade>& get_trades() const;
};

#endif // TRADE_LOG_HPP

