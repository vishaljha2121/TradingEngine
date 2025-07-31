//
// Created by Vishal Jha on 30/07/25.
//

#include "cli_utils.hpp"
#include <iostream>
#include <iomanip>
#include <sstream>

// ---------- generate_id ---------------------------------------
std::string generate_id()
{
    static std::atomic<uint64_t> counter{1};
    uint64_t n = counter.fetch_add(1, std::memory_order_relaxed);
    std::ostringstream oss;
    oss << 'O' << n;                     // e.g. O1, O2, O3 …
    return oss.str();
}

// ---------- current_timestamp ---------------------------------
long timestamp_current()
{
    using namespace std::chrono;
    return duration_cast<milliseconds>(
               system_clock::now().time_since_epoch()
           ).count();
}

// ---------- print_orders --------------------------------------
void print_orders(const OrderBook& book)
{
    auto snapshot = book.get_depth_snapshot();   // returns bids/asks map

    std::cout << "\nActive Orders\n";
    std::cout << "+---------+------+-----------+---------+\n"
              << "|  Side   |  ID  |  Price    |  Qty    |\n"
              << "+---------+------+-----------+---------+\n";

    // --- Bids (buy) -------------------------------------------
    for (const auto& [price, orders] : snapshot.bids) {
        std::cout << "|  BUY    | "
                  << std::setw(4) << " "         // IDs not in depth snap
                  << " | "
                  << std::setw(9) << std::fixed << std::setprecision(2) << price
                  << " | "
                  << std::setw(7) << orders
                  << " |\n";
    }

    // --- Asks (sell) ------------------------------------------
    for (const auto& [price, orders] : snapshot.asks) {
        std::cout << "|  SELL   | "
                  << std::setw(4) << " "
                  << " | "
                  << std::setw(9) << std::fixed << std::setprecision(2) << price
                  << " | "
                  << std::setw(7) << orders
                  << " |\n";
    }
    std::cout << "+---------+------+-----------+---------+\n";
}

// ---------- print_trades --------------------------------------
void print_trades(const TradeLog& log)
{
    const auto& trades = log.get_trades();
    std::cout << "\nTrade History (" << trades.size() << ")\n";
    std::cout << "+--------+--------+--------+-----------+---------+\n"
              << "| Trade  |  Buy   |  Sell  |  Price    |  Qty    |\n"
              << "+--------+--------+--------+-----------+---------+\n";

    for (const auto& t : trades) {
        std::cout << "| "
                  << std::setw(6) << t.trade_id << " | "
                  << std::setw(6) << t.buy_order_id << " | "
                  << std::setw(6) << t.sell_order_id << " | "
                  << std::setw(9) << std::fixed << std::setprecision(2) << t.price << " | "
                  << std::setw(7) << t.quantity << " |\n";
    }
    std::cout << "+--------+--------+--------+-----------+---------+\n";
}

// ---------- print_help ----------------------------------------
void print_help()
{
    std::cout <<
    "\nAvailable commands:\n"
    "  add_limit  <buy|sell> <price> <qty>   – place limit order\n"
    "  add_market <buy|sell>         <qty>   – place market order\n"
    "  cancel     <order_id>                 – cancel active order\n"
    "  print_depth                            – table of best bids/asks\n"
    "  print_orders                           – list current orders\n"
    "  print_trades                           – list executed trades\n"
    "  help                                   – this message\n"
    "  quit / exit / q                        – leave program\n";
}
