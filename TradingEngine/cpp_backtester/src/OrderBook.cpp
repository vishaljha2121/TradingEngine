#include "OrderBook.hpp"
#include <algorithm>
#include <iostream>
#include <iomanip> // For setprecision

OrderBook::OrderBook(const std::string& sym) : symbol(sym) {}

void OrderBook::processOrder(bool isBuy, double price, double size) {
    Order newOrder;
    newOrder.orderId = nextOrderId++;
    newOrder.price = price;
    newOrder.size = size;
    newOrder.isBuy = isBuy;

    matchOrder(newOrder);

    // If order has remaining size after matching, add it to the book
    if (newOrder.size > 0) {
        if (newOrder.isBuy) {
            insertOrderIntoBook(newOrder, bids, true);
        } else {
            insertOrderIntoBook(newOrder, asks, false);
        }
    }
}

void OrderBook::matchOrder(Order& incoming) {
    auto& bookToMatchAgainst = incoming.isBuy ? asks : bids;

    while (incoming.size > 0 && !bookToMatchAgainst.empty()) {
        auto& bestLevel = incoming.isBuy ? bookToMatchAgainst.front() : bookToMatchAgainst.front(); // Since we keep bids sorted descending, and asks sorted ascending, front() is always best price

        // Check if prices cross
        if (incoming.isBuy && incoming.price < bestLevel.price) break;
        if (!incoming.isBuy && incoming.price > bestLevel.price) break;

        // Match against orders at this price level
        auto& ordersAtLevel = bestLevel.orders;
        while (incoming.size > 0 && !ordersAtLevel.empty()) {
            auto& resting = ordersAtLevel.front();
            double tradeSize = std::min(incoming.size, resting.size);

            // Execute trade logic (omitted complex trade struct instantiation for pure performance)
            // std::cout << "Trade Executed: " << tradeSize << " @ " << resting.price << "\n";

            incoming.size -= tradeSize;
            resting.size -= tradeSize;
            bestLevel.totalSize -= tradeSize;

            if (resting.size == 0) {
                // Remove the fully filled order.
                // In a production system, erasing from the front of a vector is O(N) which is bad.
                // We would use a circular buffer or a memory tracking pool instead.
                // For this POC, vector erase demonstrates the structural shift from C# Dictionaries.
                ordersAtLevel.erase(ordersAtLevel.begin());
            }
        }

        // If the price level is empty, remove it from the book
        if (ordersAtLevel.empty()) {
            bookToMatchAgainst.erase(bookToMatchAgainst.begin());
        }
    }
}

void OrderBook::insertOrderIntoBook(const Order& order, std::vector<PriceLevel>& book, bool isBid) {
    // Find where the price level should go
    auto it = std::find_if(book.begin(), book.end(), [order](const PriceLevel& pl) {
        return pl.price == order.price;
    });

    if (it != book.end()) {
        // Price level exists
        it->orders.push_back(order);
        it->totalSize += order.size;
    } else {
        // Create new price level and maintain sorted order
        PriceLevel newLevel(order.price);
        newLevel.orders.push_back(order);
        newLevel.totalSize += order.size;
        
        book.push_back(std::move(newLevel));
        
        // Sort bids descending, asks ascending
        if (isBid) {
            std::sort(book.begin(), book.end(), [](const PriceLevel& a, const PriceLevel& b) {
                return a.price > b.price;
            });
        } else {
            std::sort(book.begin(), book.end(), [](const PriceLevel& a, const PriceLevel& b) {
                return a.price < b.price;
            });
        }
    }
}

double OrderBook::getBestBid() const {
    if (!bids.empty()) return bids.front().price;
    return 0.0;
}

double OrderBook::getBestAsk() const {
    if (!asks.empty()) return asks.front().price;
    return 0.0;
}

void OrderBook::printSnapshot() const {
    std::cout << "--- " << symbol << " Book Snapshot ---\n";
    std::cout << "Asks:\n";
    for (int i = std::min(5, (int)asks.size()) - 1; i >= 0; --i) {
         std::cout << std::fixed << std::setprecision(2) << asks[i].price << " : " << asks[i].totalSize << "\n";
    }
    std::cout << "Bids:\n";
    for (int i = 0; i < std::min(5, (int)bids.size()); ++i) {
         std::cout << std::fixed << std::setprecision(2) << bids[i].price << " : " << bids[i].totalSize << "\n";
    }
    std::cout << "---------------------------\n";
}
