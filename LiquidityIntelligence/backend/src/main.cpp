#include "App.h"
#include "json.hpp"
#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <cmath>
#include <chrono>
#include <mutex>
#include <thread>

using json = nlohmann::json;

// Compact Book Structures
struct Level {
    double price;
    double qty;
};

struct BookSide {
    std::vector<Level> levels;
};

struct BookSnapshot {
    std::string venue;
    std::string symbol;
    uint64_t local_ts_ms;
    BookSide bids;
    BookSide asks;
};

inline uint64_t now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
}

// Global State
BookSnapshot benchmark_latest;
BookSnapshot tm_latest;
std::mutex state_mutex;

std::string active_asset = "BTC";
std::string active_benchmark = "Binance";

uint64_t last_significant_move_timestamp = 0;
double last_benchmark_mid = 0.0;
double current_lag_ms = 0.0;

// Metric Calculation
double get_mid(const BookSnapshot& snap) {
    if (snap.bids.levels.empty() || snap.asks.levels.empty()) return 0;
    return (snap.bids.levels[0].price + snap.asks.levels[0].price) / 2.0;
}

double get_spread_bps(const BookSnapshot& snap) {
    if (snap.bids.levels.empty() || snap.asks.levels.empty()) return 0;
    double mid = get_mid(snap);
    return ((snap.asks.levels[0].price - snap.bids.levels[0].price) / mid) * 10000.0;
}

double get_depth_sum(const BookSide& side) {
    double sum = 0;
    for (const auto& level : side.levels) sum += level.qty;
    return sum;
}

void parse_benchmark_update(const json& data, const std::string& benchmarkName) {
    std::lock_guard<std::mutex> lock(state_mutex);
    benchmark_latest.venue = benchmarkName;
    benchmark_latest.symbol = active_asset;
    benchmark_latest.local_ts_ms = now_ms();
    
    double vol_scalar = (benchmarkName == "Coinbase") ? 2.5 : 1.0; // Scaled to match Binance profile

    benchmark_latest.bids.levels.clear();
    for (int i=0; i < 5 && i < data["bids"].size(); ++i) {
        benchmark_latest.bids.levels.push_back({
            std::stod(data["bids"][i][0].get<std::string>()), 
            std::stod(data["bids"][i][1].get<std::string>()) * vol_scalar
        });
    }
    
    benchmark_latest.asks.levels.clear();
    for (int i=0; i < 5 && i < data["asks"].size(); ++i) {
        benchmark_latest.asks.levels.push_back({
            std::stod(data["asks"][i][0].get<std::string>()), 
            std::stod(data["asks"][i][1].get<std::string>()) * vol_scalar
        });
    }

    double new_mid = get_mid(benchmark_latest);
    if (last_benchmark_mid > 0.0) {
        double delta_bps = std::abs(new_mid - last_benchmark_mid) / last_benchmark_mid * 10000.0;
        if (delta_bps > 2.0) { // Significant move
            last_significant_move_timestamp = now_ms();
        }
    }
    last_benchmark_mid = new_mid;

    // Simulate TrueMarkets Mock data relative to Benchmark
    tm_latest = benchmark_latest;
    tm_latest.venue = "TrueMarkets";
    tm_latest.local_ts_ms = benchmark_latest.local_ts_ms;
    
    // Spread padding logic (Base values map differently for SOL vs BTC)
    double mid = new_mid;
    double new_spread = get_spread_bps(benchmark_latest) + 0.5;
    
    if (last_significant_move_timestamp > 0 && (now_ms() - last_significant_move_timestamp) < 400) {
        current_lag_ms = now_ms() - last_significant_move_timestamp;
    } else {
        current_lag_ms = 0;
        tm_latest.bids.levels[0].price = mid - (mid * (new_spread / 20000.0));
        tm_latest.asks.levels[0].price = mid + (mid * (new_spread / 20000.0));
        for (auto& t : tm_latest.bids.levels) t.qty *= 0.8;
        for (auto& t : tm_latest.asks.levels) t.qty *= 0.8;
    }
}

json snap_to_json(const BookSnapshot& snap) {
    json j;
    j["venue"] = snap.venue;
    j["mid"] = get_mid(snap);
    j["spread_bps"] = get_spread_bps(snap);
    j["bid_depth_5"] = get_depth_sum(snap.bids);
    j["ask_depth_5"] = get_depth_sum(snap.asks);

    json bids = json::array();
    for (const auto& b : snap.bids.levels) bids.push_back({b.price, b.qty});
    j["bids"] = bids;

    json asks = json::array();
    for (const auto& a : snap.asks.levels) asks.push_back({a.price, a.qty});
    j["asks"] = asks;
    
    return j;
}

json build_insights() {
    json insight;
    double spread_gap = get_spread_bps(tm_latest) - get_spread_bps(benchmark_latest);
    double mid_gap = std::abs(get_mid(tm_latest) - get_mid(benchmark_latest)) / get_mid(benchmark_latest) * 10000.0;
    
    if (current_lag_ms > 0 && mid_gap > 1.0) {
        insight["status"] = "Significantly Behind";
        insight["reason"] = "Quote responsiveness behind market. Lagging move by " + std::to_string((int)current_lag_ms) + "ms";
        insight["color"] = "red";
    } else if (spread_gap > 0.4) {
        insight["status"] = "Slightly Behind";
        insight["reason"] = "True Markets spread is wider than benchmark by " + std::to_string(std::round(spread_gap * 100.0) / 100.0) + " bps";
        insight["color"] = "yellow";
    } else {
        insight["status"] = "Competitive";
        insight["reason"] = "True Markets accurately tracking benchmark liquidity.";
        insight["color"] = "green";
    }
    
    return insight;
}

struct PerSocketData {};

int main() {
    std::cout << "[Liquidity Intelligence Console] Backend Booting...\n";

    std::thread fetch_thread([]() {
        while (true) {
            std::string url;
            std::string current_bench;
            {
                std::lock_guard<std::mutex> lock(state_mutex);
                if (active_benchmark == "Binance") {
                    url = "https://api.binance.us/api/v3/depth?limit=5&symbol=" + active_asset + "USDT";
                } else {
                    url = "https://api.exchange.coinbase.com/products/" + active_asset + "-USD/book?level=2";
                }
                current_bench = active_benchmark;
            }

            std::string cmd = "curl -s '" + url + "'";
            FILE* pipe = popen(cmd.c_str(), "r");
            if (pipe) {
                char buffer[4096];
                std::string result = "";
                while (fgets(buffer, sizeof(buffer), pipe) != nullptr) result += buffer;
                pclose(pipe);
                try {
                    json d = json::parse(result);
                    if (d.contains("bids")) {
                        parse_benchmark_update(d, current_bench);
                    }
                } catch(...) {}
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(250));
        }
    });

    uWS::App app;
    uWS::Loop* main_loop = uWS::Loop::get();

    std::thread broadcast_thread([&app, main_loop]() {
        while (true) {
            std::this_thread::sleep_for(std::chrono::milliseconds(250));
            std::string msg;
            {
                std::lock_guard<std::mutex> lock(state_mutex);
                if (benchmark_latest.bids.levels.empty()) continue; 
                json payload;
                payload["benchmark"] = snap_to_json(benchmark_latest);
                payload["truemarkets"] = snap_to_json(tm_latest);
                payload["insights"] = build_insights();
                payload["timestamp"] = now_ms();
                msg = payload.dump();
            }
            main_loop->defer([&app, msg]() {
                app.publish("broadcast", msg, uWS::OpCode::TEXT, false);
            });
        }
    });

    app.ws<PerSocketData>("/*", {
        .compression = uWS::SHARED_COMPRESSOR,
        .open = [](auto *ws) {
            std::cout << "[WS] UI Connected\n";
            ws->subscribe("broadcast");
        },
        .message = [](auto *ws, std::string_view message, uWS::OpCode opCode) {
            try {
                json d = json::parse(message);
                if (d.contains("action") && d["action"] == "subscribe") {
                    std::lock_guard<std::mutex> lock(state_mutex);
                    active_asset = d["asset"].get<std::string>();
                    active_benchmark = d["benchmark"].get<std::string>();
                    benchmark_latest.bids.levels.clear(); // Reset to show loading
                }
            } catch(...) {}
        },
        .close = [](auto *ws, int code, std::string_view message) {
            std::cout << "[WS] UI Disconnected\n";
        }
    })
    .listen(9001, [](auto *listen_socket) {
        if (listen_socket) std::cout << "[WS] Engine listening on 9001\n";
    })
    .run();

    fetch_thread.join();
    broadcast_thread.join();
    return 0;
}
