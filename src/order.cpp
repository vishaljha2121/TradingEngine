#include "order.hpp"

Order::Order(std::string id, double price, int qty, OrderSide order_side, long timestamp, OrderType order_type) :
    order_id(id),
    price(price),
    quantity(qty),
    side(order_side),
    timestamp(timestamp),
    is_active(true),
    type(order_type),
    status(OrderStatus::ACTIVE)
{}
