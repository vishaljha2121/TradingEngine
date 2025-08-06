//
// Created by Vishal Jha on 26/07/25.
//

// trade_log.cpp
#include "trade_log.hpp"

#include <sstream>

using namespace std;

static string make_filename()
{
    auto now   = chrono::system_clock::now();
    auto t     = chrono::system_clock::to_time_t(now);
    tm   tm{}; localtime_r(&t, &tm);

    stringstream ss;
    ss << "trades_"
       << put_time(&tm, "%Y-%m-%d_%H%M%S")
       << ".csv";
    return ss.str();
}

TradeLog::TradeLog()
{
    const string fname = make_filename();
    file_.open(fname, ios::out | ios::trunc);
    if (!file_)
        throw runtime_error("Cannot open trade log file");

    // header
    file_ << "trade_id,buy_order_id,sell_order_id,price,quantity,timestamp_ms\n";
}

TradeLog::~TradeLog()
{
    if (file_.is_open())
        file_.close();
}

void TradeLog::record_trade(const Trade& trade) {
    trades_.push_back(trade);

    file_ << trade.trade_id      << ','
          << trade.buy_order_id  << ','
          << trade.sell_order_id << ','
          << trade.price         << ','
          << trade.quantity      << ','
          << trade.timestamp  << '\n';
    file_.flush();
}

const std::vector<Trade>& TradeLog::get_trades() const {
    return trades_;
}
