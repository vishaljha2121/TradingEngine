#pragma once
#include <string>

enum class OrderSide { BUY, SELL };
enum class OrderType { LIMIT, MARKET };
enum class OrderStatus { ACTIVE, FILLED, CANCELLED, EXPIRED };

class Order {
public:
    std::string order_id;
    double price;
    int quantity;
    OrderSide side;
    long timestamp;
    bool is_active;
    OrderType type;
    OrderStatus status;

    Order(std::string order_id, double price, int qty, OrderSide side, long timestamp, OrderType type = OrderType::LIMIT);
};
