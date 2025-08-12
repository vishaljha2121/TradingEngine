//
// Created by Vishal Jha on 07/08/25.
//

#include "rest_server.hpp"

// rest_server.cpp
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/asio.hpp>
#include <iostream>
#include <string>
#include <thread>
#include <nlohmann/json.hpp>
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include "order_book.hpp"
#include "order.hpp"
#include <optional>

using namespace drogon;

class OrderController : public drogon::HttpController<OrderController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(OrderController::addOrder, "/add_order", Post);
        ADD_METHOD_TO(OrderController::getDepth, "/depth", Get);
    METHOD_LIST_END

    // POST /add_order
    void addOrder(const HttpRequestPtr &req,
              std::function<void(const HttpResponsePtr &)> &&callback) {
        auto json = req->getJsonObject();
        if (!json || !json->isMember("order_id") || !json->isMember("price") ||
            !json->isMember("quantity") || !json->isMember("side") ||
            !json->isMember("type")) {
            auto resp = HttpResponse::newHttpJsonResponse(Json::Value("Invalid JSON"));
            resp->setStatusCode(k400BadRequest);
            return callback(resp);
        }

        try {
            // Current time in ms
            long now_ms = currentTimeMillis();

            // Extract fields
            std::string id = (*json)["order_id"].asString();
            double price = (*json)["price"].asDouble();
            int qty = (*json)["quantity"].asInt();
            std::string sideStr = (*json)["side"].asString();
            std::string typeStr = (*json)["type"].asString();

            // Optional expiry — treated as offset from now in ms
            std::optional<long> expiry;
            if (json->isMember("expiry_ms")) {
                expiry = now_ms + (*json)["expiry_ms"].asInt64();
            }

            OrderSide side = (sideStr == "BUY") ? OrderSide::BUY : OrderSide::SELL;
            OrderType type = (typeStr == "MARKET") ? OrderType::MARKET : OrderType::LIMIT;

            // Create and add the order
            Order order(id, price, qty, side, now_ms, expiry, type);
            book.add_order(order);

            // Print details
            std::cout << "\n=== Order Added ===\n";
            std::cout << "ID: " << id << "\n";
            std::cout << "Side: " << (side == OrderSide::BUY ? "BUY" : "SELL") << "\n";
            std::cout << "Type: " << (type == OrderType::MARKET ? "MARKET" : "LIMIT") << "\n";
            std::cout << "Price: " << price << "\n";
            std::cout << "Quantity: " << qty << "\n";

            if (expiry.has_value()) {
                // Convert to IST (UTC+5:30)
                std::time_t expiry_time_t = expiry.value() / 1000;
                expiry_time_t += 19800; // 5 hours 30 minutes in seconds

                std::tm *ist_tm = std::gmtime(&expiry_time_t);

                std::ostringstream oss;
                oss << std::put_time(ist_tm, "%Y-%m-%d %H:%M:%S");
                std::cout << "Expires At (IST): " << oss.str() << "\n";
            } else {
                std::cout << "No expiry\n";
            }
            std::cout << "===================\n";

            // Response
            Json::Value resp;
            resp["status"] = "Order added";
            callback(HttpResponse::newHttpJsonResponse(resp));

        } catch (const std::exception &e) {
            Json::Value resp;
            resp["error"] = e.what();
            auto r = HttpResponse::newHttpJsonResponse(resp);
            r->setStatusCode(k500InternalServerError);
            callback(r);
        }
    }


    // GET /depth
    void getDepth(const HttpRequestPtr &req,
                  std::function<void(const HttpResponsePtr &)> &&callback) {

        DepthSnapshot snap = book.get_depth_snapshot();
        Json::Value json;

        for (const auto &[price, qty] : snap.bids) {
            Json::Value level;
            level["price"] = price;
            level["quantity"] = qty;
            json["bids"].append(level);
        }

        for (const auto &[price, qty] : snap.asks) {
            Json::Value level;
            level["price"] = price;
            level["quantity"] = qty;
            json["asks"].append(level);
        }
        callback(HttpResponse::newHttpJsonResponse(json));
    }

    static size_t purgeBook() {
        return book.purge_expired();
    }

private:
    inline static OrderBook book; // Shared across requests
    static long currentTimeMillis() {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::system_clock::now().time_since_epoch()
               ).count();
    }
};

int main() {
    drogon::app()
        .addListener("0.0.0.0", 8080)
        .setThreadNum(4);

    drogon::app().getLoop()->runEvery(5.0, []() {
        std::cout << "PURGE CALLED";
        size_t purged = OrderController::purgeBook();
        std::cout << "[PURGE] Removed " << purged << " expired orders\n";
    });

    drogon::app().run();
}
