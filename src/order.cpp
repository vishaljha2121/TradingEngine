#include "order.hpp"

Order::Order(std::string id, double price, int qty, OrderSide order_side, long timestamp, std::optional<long> exp, OrderType order_type) :
    order_id(id),
    price(price),
    quantity(qty),
    side(order_side),
    timestamp(timestamp),
    is_active(true),
    type(order_type),
    status(OrderStatus::ACTIVE),
    expiry_ms(exp)
{}

Order::Order(const std::string& id,
          double            price,
          int               quantity,
          OrderSide         side,
          long              timestamp,
          OrderType         type,
          std::optional<long> exp)
        : Order(id, price, quantity, side, timestamp, exp, type)
{}