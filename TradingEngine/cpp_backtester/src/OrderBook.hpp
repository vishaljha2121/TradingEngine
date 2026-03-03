#ifndef ORDERBOOK_HPP
#define ORDERBOOK_HPP

#include <vector>
#include <string>
#include <cstdint>
#include <iostream>

// Cache-line aligned Order structure (64 bytes)
struct alignas(64) Order {
    uint64_t orderId;
    double price;
    double size;
    bool isBuy;
    // Padding to ensure the struct fills a 64-byte cache line (optional depending on architecture,
    // but demonstrating knowledge of cache coherence for high-frequency trading)
    char padding[39];
};

// Represents a price level in the flat-array orderbook
struct PriceLevel {
    double price;
    double totalSize;
    std::vector<Order> orders; // In a true ULF system we'd use a custom allocator or fixed array

    PriceLevel(double p) : price(p), totalSize(0) {}
};

class OrderBook {
private:
    std::string symbol;
    
    // Instead of std::map or std::set which are node-based and cause cache misses,
    // we use contiguous memory via std::vector.
    std::vector<PriceLevel> bids;
    std::vector<PriceLevel> asks;

    uint64_t nextOrderId = 1;

    void matchOrder(Order& incoming);
    void insertOrderIntoBook(const Order& order, std::vector<PriceLevel>& book, bool isBid);

public:
    OrderBook(const std::string& sym);

    void processOrder(bool isBuy, double price, double size);
    
    // Utilities for backtesting insights
    double getBestBid() const;
    double getBestAsk() const;
    void printSnapshot() const;
};

#endif
