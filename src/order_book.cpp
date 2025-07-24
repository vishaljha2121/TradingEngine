//
// Created by Vishal Jha on 23/07/25.
//

#include "order_book.hpp"

#include <iostream>

void OrderBook::add_order(const Order& order) {
    match_order(order);
}

void OrderBook::match_order(const Order &order) {
    Order incomingOrder = order;

    auto& opposingBook = (incomingOrder.side == OrderSide::BUY) ? asks : bids;
    if (incomingOrder.side == OrderSide::BUY) {
        auto askLevelIterator = opposingBook.begin();
        while (incomingOrder.quantity > 0 && askLevelIterator != opposingBook.end()) {
            double bookPrice = askLevelIterator->first;
            if (!(incomingOrder.price >= bookPrice))
                break;

            auto& restingOrderQueue = askLevelIterator->second;
            while (!restingOrderQueue.empty() && incomingOrder.quantity > 0) {
                Order& restingOrderAtPriceLevel = restingOrderQueue.front(); // this is the first order in queue waiting to be matched
                int tradedQuantity = std::min(incomingOrder.quantity, restingOrderAtPriceLevel.quantity);
                std::cout << "TRADE: " << tradedQuantity << " @ " << restingOrderAtPriceLevel.price << std::endl;

                incomingOrder.quantity -= tradedQuantity;
                restingOrderAtPriceLevel.quantity -= tradedQuantity;

                if (restingOrderAtPriceLevel.quantity == 0)
                    restingOrderQueue.pop_front();
            }

            if (restingOrderQueue.empty())
                opposingBook.erase(askLevelIterator->first);
            askLevelIterator = opposingBook.begin(); // Revalidate
        }

    }
    else if (incomingOrder.side == OrderSide::SELL) {
        auto bidLevelIterator = opposingBook.rbegin();
        while (incomingOrder.quantity > 0 && bidLevelIterator != opposingBook.rend()) {
            double bookPrice = bidLevelIterator->first;
            if (!(incomingOrder.price <= bookPrice))
                break;

            auto& restingOrderQueue = bidLevelIterator->second;
            while (!restingOrderQueue.empty() && incomingOrder.quantity > 0) {
                Order& restingOrderAtPriceLevel = restingOrderQueue.front(); // this is the first order in queue waiting to be matched
                int tradedQuantity = std::min(incomingOrder.quantity, restingOrderAtPriceLevel.quantity);
                std::cout << "TRADE: " << tradedQuantity << " @ " << restingOrderAtPriceLevel.price << std::endl;

                incomingOrder.quantity -= tradedQuantity;
                restingOrderAtPriceLevel.quantity -= tradedQuantity;

                if (restingOrderAtPriceLevel.quantity == 0)
                    restingOrderQueue.pop_front();
            }

            if (restingOrderQueue.empty())
                opposingBook.erase(bidLevelIterator->first);
            bidLevelIterator = opposingBook.rbegin(); // Revalidate
        }
    }
    if (incomingOrder.quantity > 0) {
        auto& targetBook = (incomingOrder.side == OrderSide::BUY) ? bids : asks;
        targetBook[incomingOrder.price].push_back(incomingOrder);
        order_index[incomingOrder.order_id] = { incomingOrder.price, incomingOrder.side };
    }
}

void OrderBook::cancel_order(const std::string& order_id) {
    auto it = order_index.find(order_id);
    if (it == order_index.end()) return;

    auto [price, side] = it->second;
    auto& book = (side == OrderSide::BUY) ? bids : asks;

    auto queue_it = book.find(price);
    if (queue_it == book.end()) return;

    auto& queue = queue_it->second;
    queue.remove_if([&](const Order& o) { return o.order_id == order_id; });

    if (queue.empty()) book.erase(price);
    order_index.erase(order_id);
}

void OrderBook::print_book() {
    std::cout << "\nASKS:\n";
    for (auto& [price, orders] : asks) {
        int total = 0;
        for (const auto& o : orders) total += o.quantity;
        std::cout << price << " : " << total << "\n";
    }

    std::cout << "BIDS:\n";
    for (auto it = bids.rbegin(); it != bids.rend(); ++it) {
        int total = 0;
        for (const auto& o : it->second) total += o.quantity;
        std::cout << it->first << " : " << total << "\n";
    }
}
