#include "order.hpp"

Order::Order(std::string id, double pr, int qty, OrderSide s, long ts)
    : order_id(id), price(pr), quantity(qty), side(s), timestamp(ts), is_active(true) {}
