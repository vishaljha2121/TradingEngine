#pragma once
#include <string>

enum class OrderSide { BUY, SELL };

class Order {
public:
    std::string order_id;
    double price;
    int quantity;
    OrderSide side;
    long timestamp;
    bool is_active;

    Order(std::string id, double pr, int qty, OrderSide s, long ts);
};
