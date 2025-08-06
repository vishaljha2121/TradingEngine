//
// Created by Vishal Jha on 30/07/25.
//

#ifndef CLI_UTILS_HPP
#define CLI_UTILS_HPP

#pragma once
#include "order_book.hpp"
#include "trade_log.hpp"
#include <string>
#include <chrono>
#include <atomic>

// ID generator --------------------------------------------------
std::string generate_id();               // returns unique order ID

// Time helper ---------------------------------------------------
long current_timestamp();                // epoch-ms

// Pretty printers ----------------------------------------------
void print_orders(const OrderBook& book); // active orders (price-time)
void print_trades(const TradeLog& log);   // all trades so far
void print_help();                        // one-screen command list

#endif //CLI_UTILS_HPP
