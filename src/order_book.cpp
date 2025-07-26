//
// Created by Vishal Jha on 23/07/25.
//

#include "order_book.hpp"

#include <iostream>
#include <algorithm>
#include <iomanip>
#include <type_traits>

namespace {
    template<typename T>
    struct is_std_reverse_iterator : std::false_type {
    };

    template<typename IteratorType>
    struct is_std_reverse_iterator<std::reverse_iterator<IteratorType> > : std::true_type {
    };

    template<typename Iterator>
    void process_matches_at_price_level(
        Iterator priceLevelIt,
        Order &incomingOrder,
        std::map<double, std::list<Order> > &opposingBook,
        OrderBook* bookPtr) {
        auto &restingOrderQueue = priceLevelIt->second;
        while (!restingOrderQueue.empty() && incomingOrder.quantity > 0) {
            Order &restingOrder = restingOrderQueue.front();
            int tradedQuantity = std::min(incomingOrder.quantity, restingOrder.quantity);
            std::cout << "TRADE: " << tradedQuantity << " @ " << restingOrder.price << std::endl;

            if (incomingOrder.side == OrderSide::BUY) {
                bookPtr->record_trade(incomingOrder.order_id, restingOrder.order_id, restingOrder.price, tradedQuantity);
            } else {
                bookPtr->record_trade(restingOrder.order_id, incomingOrder.order_id, restingOrder.price, tradedQuantity);
            }

            incomingOrder.quantity -= tradedQuantity;
            restingOrder.quantity -= tradedQuantity;

            if (restingOrder.quantity == 0) {
                restingOrderQueue.pop_front();
            }
        }

        if (restingOrderQueue.empty()) {
            // Detect forward iterator vs reverse iterator
            if constexpr (is_std_reverse_iterator<Iterator>::value) {
                auto baseIt = priceLevelIt.base();
                opposingBook.erase(--baseIt);
            } else {
                opposingBook.erase(priceLevelIt);
            }
        }
    }

    void match_buy_order(Order &incomingOrder, std::map<double, std::list<Order> > &asks, OrderBook* bookPtr) {
        for (auto it = asks.begin(); it != asks.end() && incomingOrder.quantity > 0;) {
            double askPrice = it->first;

            if (incomingOrder.price < askPrice) {
                break;
            }

            process_matches_at_price_level(it, incomingOrder, asks, bookPtr);

            // Reinitialize iterator after possible erase:
            it = asks.lower_bound(askPrice);
            if (it == asks.end() || it->first != askPrice) {
                // Price level erased, iterator at next price or end
            } else {
                ++it;
            }
        }
    }

    void match_sell_order(Order &incomingOrder, std::map<double, std::list<Order> > &bids, OrderBook* bookPtr) {
        for (auto reverseIt = bids.rbegin(); reverseIt != bids.rend() && incomingOrder.quantity > 0;) {
            double bidPrice = reverseIt->first;

            if (incomingOrder.price > bidPrice) {
                break;
            }
            process_matches_at_price_level(reverseIt, incomingOrder, bids, bookPtr);

            // Recalculate reverse iterator after possible erase
            auto baseIt = reverseIt.base();
            --baseIt; // Adjust to the element to be erased

            reverseIt = std::make_reverse_iterator(baseIt);
            ++reverseIt;
        }
    }

    // Add the unmatched portion of the order to the appropriate side book and update order_index
    void add_remaining_order(
        const Order &order,
        std::map<double, std::list<Order> > &bids,
        std::map<double, std::list<Order> > &asks,
        std::unordered_map<std::string, std::pair<double, OrderSide> > &order_index) {
        auto &targetBook = (order.side == OrderSide::BUY) ? bids : asks;
        targetBook[order.price].push_back(order);
        order_index[order.order_id] = {order.price, order.side};
    }
}


// === Public interface implementation === //
void OrderBook::add_order(const Order &order) {
    match_order(order);
}

void OrderBook::match_order(const Order &order) {
    Order incomingOrder = order;

    if (incomingOrder.type == OrderType::MARKET) {
        handle_market_order(incomingOrder);
        return;
    }

    auto &opposingBook = (incomingOrder.side == OrderSide::BUY) ? asks : bids;
    if (incomingOrder.side == OrderSide::BUY) {
        match_buy_order(incomingOrder, opposingBook, this);
    } else {
        match_sell_order(incomingOrder, opposingBook, this);
    }

    if (incomingOrder.quantity > 0) {
        add_remaining_order(incomingOrder, bids, asks, order_index);
    }
}

void OrderBook::cancel_order(const std::string &order_id) {
    auto it = order_index.find(order_id);
    if (it == order_index.end()) {
        return;
    }
    auto [price, side] = it->second;
    auto &book = (side == OrderSide::BUY) ? bids : asks;

    auto queueIt = book.find(price);
    if (queueIt == book.end()) {
        return;
    }

    auto &orderQueue = queueIt->second;
    orderQueue.remove_if([&order_id](const Order &order) { return order.order_id == order_id; });

    if (orderQueue.empty()) {
        book.erase(price);
    }
    order_index.erase(it);
}

double OrderBook::get_best_bid() const {
    if (bids.empty()) return 0.0;
    return bids.rbegin()->first;
}

double OrderBook::get_best_ask() const {
    if (asks.empty()) return 0.0;
    return asks.begin()->first;
}

void OrderBook::handle_market_order(Order &incomingOrder) {
    auto &opposingBook = (incomingOrder.side == OrderSide::BUY) ? asks : bids;

    while (!opposingBook.empty() && incomingOrder.quantity > 0) {
        auto priceLevelIt = (incomingOrder.side == OrderSide::BUY) ? opposingBook.begin() : std::prev(opposingBook.end());
        auto &orderQueue = priceLevelIt->second;
        Order &restingOrder = orderQueue.front();

        int tradedQty = std::min(incomingOrder.quantity, restingOrder.quantity);
        std::cout << "TRADE: " << tradedQty << " @ " << restingOrder.price << std::endl;

        incomingOrder.quantity -= tradedQty;
        restingOrder.quantity -= tradedQty;

        if (restingOrder.quantity == 0) {
            orderQueue.pop_front();
        }

        if (orderQueue.empty()) {
            opposingBook.erase(priceLevelIt);
        }
    }
}

long current_timestamp() {
    return std::chrono::system_clock::now().time_since_epoch() / std::chrono::milliseconds(1);
}

void OrderBook::record_trade(const std::string& buy_id, const std::string& sell_id, double price, int qty) {
    const std::string trade_id = "T" + std::to_string(trade_counter++);
    const Trade t(trade_id, buy_id, sell_id, price, qty, current_timestamp());
    trade_log.push_back(t);
}

void OrderBook::print_book() {
    // Collect asks (lowest to highest)
    std::vector<std::pair<double, int> > asksVec;
    for (const auto &[price, orders]: asks) {
        int total = 0;
        for (const auto &order: orders)
            total += order.quantity;
        asksVec.emplace_back(price, total);
    }

    // Collect bids (highest to lowest)
    std::vector<std::pair<double, int> > bidsVec;
    for (auto it = bids.rbegin(); it != bids.rend(); ++it) {
        int total = 0;
        for (const auto &order: it->second)
            total += order.quantity;
        bidsVec.emplace_back(it->first, total);
    }

    // Print table header
    std::cout << "+-----------+---------+-----------+---------+\n";
    std::cout << "| ASK Price | ASK Qty | BID Price | BID Qty |\n";
    std::cout << "+-----------+---------+-----------+---------+\n";

    size_t rows = std::max(asksVec.size(), bidsVec.size());
    for (size_t i = 0; i < rows; ++i) {
        // Ask columns
        if (i < asksVec.size())
            std::cout << "| " << std::setw(9) << std::fixed << std::setprecision(2) << asksVec[i].first
                    << " | " << std::setw(7) << asksVec[i].second;
        else
            std::cout << "|           |         ";

        // Bid columns
        if (i < bidsVec.size())
            std::cout << " | " << std::setw(9) << std::fixed << std::setprecision(2) << bidsVec[i].first
                    << " | " << std::setw(7) << bidsVec[i].second << " |\n";
        else
            std::cout << " |           |         |\n";
    }
    std::cout << "+-----------+---------+-----------+---------+\n";
    std::cout << "   Price      Qty      Price      Qty\n";
}

void OrderBook::print_depth_snapshot() const {
    std::cout << "----- Order Book Depth -----\n";

    std::cout << "Asks:\n";
    for (const auto &level : asks) {
        double totalQty = 0;
        for (const auto &order : level.second) {
            totalQty += order.quantity;
        }
        std::cout << "Price: " << level.first << ", Quantity: " << totalQty << "\n";
    }

    std::cout << "Bids:\n";
    for (auto it = bids.rbegin(); it != bids.rend(); ++it) {
        double totalQty = 0;
        for (const auto &order : it->second) {
            totalQty += order.quantity;
        }
        std::cout << "Price: " << it->first << ", Quantity: " << totalQty << "\n";
    }

    std::cout << "----------------------------\n";
}
