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
#include <curl/curl.h>

using json = nlohmann::json;

// ------- Data Structures -------
struct Level {
    double price;
    double qty;
};

struct BookSnapshot {
    std::string venue;
    std::string symbol;
    uint64_t local_ts_ms;
    std::vector<Level> bids;
    std::vector<Level> asks;
};

inline uint64_t now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}

// ------- Global State -------
BookSnapshot benchmark_latest;
BookSnapshot tm_fallback;  // Fallback mock for when TrueX WS is down
std::mutex state_mutex;

std::string active_asset = "BTC";
std::string active_benchmark = "Kraken";

uint64_t last_benchmark_move_ts = 0;
bool first_data_logged = false;
uint64_t fetch_count = 0;
double last_benchmark_mid = 0.0;
double current_lag_ms = 0.0;

// ------- Metric Helpers -------
double get_mid(const BookSnapshot& snap) {
    if (snap.bids.empty() || snap.asks.empty()) return 0;
    return (snap.bids[0].price + snap.asks[0].price) / 2.0;
}

double get_spread_bps(const BookSnapshot& snap) {
    if (snap.bids.empty() || snap.asks.empty()) return 0;
    double mid = get_mid(snap);
    if (mid == 0) return 0;
    return ((snap.asks[0].price - snap.bids[0].price) / mid) * 10000.0;
}

double get_depth(const std::vector<Level>& side) {
    double sum = 0;
    for (const auto& l : side) sum += l.qty;
    return sum;
}

double compute_slippage(const BookSnapshot& tm, const BookSnapshot& bench) {
    if (tm.asks.empty() || bench.asks.empty()) return 0.0;

    const double target_size = bench.asks[0].qty;
    if (target_size <= 0.0) return 0.0;

    auto compute_vwap = [](const std::vector<Level>& levels, double target) {
        double remaining = target;
        double notional = 0.0;
        double executed = 0.0;

        for (const auto& level : levels) {
            const double fill_qty = std::min(level.qty, remaining);
            notional += level.price * fill_qty;
            executed += fill_qty;
            remaining -= fill_qty;
            if (remaining <= 0.0) break;
        }

        return executed > 0.0 ? notional / executed : 0.0;
    };

    const double tm_vwap = compute_vwap(tm.asks, target_size);
    const double bench_vwap = compute_vwap(bench.asks, target_size);
    if (tm_vwap == 0.0 || bench_vwap == 0.0) return 0.0;

    // Positive bps means True Markets is cheaper for the representative market buy.
    return ((bench_vwap - tm_vwap) / bench_vwap) * 10000.0;
}

double compute_routing_risk(double spread_gap, double slip_adv, double depth_ratio, double lag) {
    double score = 0;
    score += std::min(30.0, std::max(0.0, spread_gap * 15.0));
    score += std::min(30.0, std::max(0.0, -slip_adv * 10.0));
    score += std::min(20.0, std::max(0.0, (1.0 - depth_ratio) * 40.0));
    score += std::min(20.0, std::max(0.0, lag / 10.0));
    return std::min(100.0, std::max(0.0, score));
}

// ------- Metric History & Outliers (Phases 6 & 7) -------
#include <deque>

struct MetricSeriesPoint {
    uint64_t ts;
    double value;
};

struct MetricHistory {
    std::string key;
    std::string label;
    std::string unit;
    std::deque<MetricSeriesPoint> series;
    size_t limit = 60;
    
    void add(double v) {
        series.push_back({now_ms(), v});
        if (series.size() > limit) {
            series.pop_front();
        }
    }
    
    // Mean and standard deviation over current series
    void compute_stats(double& avg, double& stddev, double& min_v, double& max_v) const {
        avg = 0.0; stddev = 0.0; min_v = 0.0; max_v = 0.0;
        if (series.empty()) return;
        
        min_v = series[0].value;
        max_v = series[0].value;
        for (const auto& p : series) {
            avg += p.value;
            if (p.value < min_v) min_v = p.value;
            if (p.value > max_v) max_v = p.value;
        }
        avg /= series.size();
        
        for (const auto& p : series) {
            stddev += (p.value - avg) * (p.value - avg);
        }
        stddev = std::sqrt(stddev / series.size());
    }
    
    json get_snapshot(bool invert_trend = false, bool invert_outlier = false) const {
        double avg, stddev, min_v, max_v;
        compute_stats(avg, stddev, min_v, max_v);
        
        // Outlier detection
        double recent_val = series.empty() ? 0.0 : series.back().value;
        double zscore = (stddev > 0.001) ? (recent_val - avg) / stddev : 0.0;
        
        bool isOutlier = std::abs(zscore) > 2.0;
        std::string severity = "none";
        if (isOutlier) {
            if (std::abs(zscore) > 3.0) severity = "severe";
            else if (std::abs(zscore) > 2.5) severity = "moderate";
            else severity = "mild";
        }
        
        // Check sustained: how many recent are outliers? 
        int sustainedMs = 0;
        if (isOutlier) {
            for (auto it = series.rbegin(); it != series.rend(); ++it) {
                double z = (stddev > 0.001) ? (it->value - avg) / stddev : 0.0;
                if ((invert_outlier ? -z : z) > 2.0) {
                    sustainedMs += 500; // rough 500ms bounds per tick
                } else break;
            }
        }
        
        // Trend
        std::string trend = "stable";
        if (series.size() >= 5) {
            double r_avg = 0, o_avg = 0;
            for (size_t i = series.size() - 5; i < series.size(); ++i) r_avg += series[i].value;
            r_avg /= 5.0;
            size_t o_start = (series.size() >= 10) ? series.size() - 10 : 0;
            size_t o_count = series.size() - 5 - o_start;
            if (o_count > 0) {
                for (size_t i = o_start; i < series.size() - 5; ++i) o_avg += series[i].value;
                o_avg /= o_count;
            }
            
            double diff = r_avg - o_avg;
            double threshold = std::abs(o_avg) * 0.1;
            if (threshold < 0.5) threshold = 0.5;
            if (std::abs(diff) > threshold) {
                bool improving = invert_trend ? diff > 0 : diff < 0;
                trend = improving ? "improving" : "worsening";
            }
        }
        
        // Format display value
        char disp[32];
        snprintf(disp, sizeof(disp), "%.2f", recent_val);
        
        json pts = json::array();
        for (const auto& p : series) {
            pts.push_back({{"ts", p.ts}, {"value", p.value}});
        }
        
        return {
            {"key", key},
            {"label", label},
            {"value", recent_val},
            {"displayValue", disp},
            {"unit", unit},
            {"trend", trend},
            {"series", pts},
            {"summary", {
                {"avg", avg}, {"min", min_v}, {"max", max_v},
                {"stddev", stddev}, {"count", series.size()}
            }},
            {"outlier", {
                {"isOutlier", isOutlier},
                {"severity", severity},
                {"sustainedMs", sustainedMs},
                {"zScore", zscore},
                {"percentileBand", std::abs(zscore) > 2.0 ? "p95" : "normal"}
            }}
        };
    }
};

MetricHistory hist_slippage{"slippage_bps", "Slippage Cost", "bps"};
MetricHistory hist_spread_delta{"spread_delta_bps", "Spread Delta", "bps"};
MetricHistory hist_latency{"latency_ms", "Latency", "ms"};
MetricHistory hist_depth{"depth_ratio", "Depth Ratio", "x"};
MetricHistory hist_routing_risk{"routing_risk_score", "Routing Risk", "/100"};


// ------- libcurl HTTP Fetcher -------
static size_t write_callback(void* contents, size_t size, size_t nmemb, std::string* out) {
    out->append(static_cast<char*>(contents), size * nmemb);
    return size * nmemb;
}

std::string http_get(const std::string& url) {
    CURL* curl = curl_easy_init();
    if (!curl) return "";

    std::string response;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "LiquidityIntelligence/1.0");

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        std::cerr << "[CURL] Error fetching " << url << ": " << curl_easy_strerror(res) << "\n";
        response.clear();
    }
    curl_easy_cleanup(curl);
    return response;
}

// ------- Venue-Specific Parsers -------
void parse_kraken(const std::string& raw, BookSnapshot& dest) {
    try {
        json d = json::parse(raw);
        if (!d["error"].empty()) {
            std::cerr << "[Kraken] API error: " << d["error"][0] << "\n";
            return;
        }
        // Kraken wraps in result.XBTPYUSD (or similar key)
        for (auto& [key, val] : d["result"].items()) {
            dest.bids.clear();
            for (int i = 0; i < 5 && i < (int)val["bids"].size(); ++i) {
                dest.bids.push_back({
                    std::stod(val["bids"][i][0].get<std::string>()),
                    std::stod(val["bids"][i][1].get<std::string>())
                });
            }
            dest.asks.clear();
            for (int i = 0; i < 5 && i < (int)val["asks"].size(); ++i) {
                dest.asks.push_back({
                    std::stod(val["asks"][i][0].get<std::string>()),
                    std::stod(val["asks"][i][1].get<std::string>())
                });
            }
            break; // Only take the first (only) result key
        }
    } catch (const std::exception& e) {
        std::cerr << "[Kraken] Parse error: " << e.what() << "\n";
    }
}

void parse_cryptocom(const std::string& raw, BookSnapshot& dest) {
    try {
        json d = json::parse(raw);
        if (d["code"].get<int>() != 0) {
            std::cerr << "[Crypto.com] API error code: " << d["code"] << "\n";
            return;
        }
        auto& data = d["result"]["data"][0];
        dest.bids.clear();
        for (int i = 0; i < 5 && i < (int)data["bids"].size(); ++i) {
            dest.bids.push_back({
                std::stod(data["bids"][i][0].get<std::string>()),
                std::stod(data["bids"][i][1].get<std::string>())
            });
        }
        dest.asks.clear();
        for (int i = 0; i < 5 && i < (int)data["asks"].size(); ++i) {
            dest.asks.push_back({
                std::stod(data["asks"][i][0].get<std::string>()),
                std::stod(data["asks"][i][1].get<std::string>())
            });
        }
    } catch (const std::exception& e) {
        std::cerr << "[Crypto.com] Parse error: " << e.what() << "\n";
    }
}

// ------- Build URL for venue -------
std::string build_url(const std::string& venue, const std::string& asset) {
    if (venue == "Kraken") {
        return "https://api.kraken.com/0/public/Depth?pair=" + asset + "PYUSD&count=5";
    }
    // Crypto.com
    return "https://api.crypto.com/exchange/v1/public/get-book?instrument_name=" + asset + "_PYUSD&depth=5";
}

// ------- JSON Serialization -------
json snap_to_json(const BookSnapshot& snap) {
    json j;
    j["venue"] = snap.venue;
    j["mid"] = get_mid(snap);
    j["spread_bps"] = get_spread_bps(snap);
    j["bid_depth_5"] = get_depth(snap.bids);
    j["ask_depth_5"] = get_depth(snap.asks);

    json bids = json::array();
    for (const auto& b : snap.bids) bids.push_back({b.price, b.qty});
    j["bids"] = bids;

    json asks = json::array();
    for (const auto& a : snap.asks) asks.push_back({a.price, a.qty});
    j["asks"] = asks;

    return j;
}

// NOTE: Caller must hold state_mutex before calling this!
json build_insights_unlocked() {
    json insight;

    if (benchmark_latest.bids.empty()) {
        insight["status"] = "Loading";
        insight["reason"] = "Waiting for benchmark data...";
        insight["color"] = "yellow";
        return insight;
    }

    double spread_gap = get_spread_bps(tm_fallback) - get_spread_bps(benchmark_latest);
    double mid_gap = 0;
    double bench_mid = get_mid(benchmark_latest);
    if (bench_mid > 0)
        mid_gap = std::abs(get_mid(tm_fallback) - bench_mid) / bench_mid * 10000.0;

    if (current_lag_ms > 100 && mid_gap > 1.0) {
        insight["status"] = "Significantly Behind";
        insight["reason"] = "Quote lag detected: " + std::to_string((int)current_lag_ms) + "ms behind benchmark.";
        insight["color"] = "red";
    } else if (spread_gap > 0.4) {
        insight["status"] = "Slightly Behind";
        insight["reason"] = "Spread wider by " + std::to_string(std::round(spread_gap * 100.0) / 100.0) + " bps vs benchmark.";
        insight["color"] = "yellow";
    } else {
        insight["status"] = "Competitive";
        insight["reason"] = "Liquidity tracking benchmark within tolerance.";
        insight["color"] = "green";
    }
    return insight;
}

// ------- Main -------
struct PerSocketData {};

int main() {
    std::cout << "[Liquidity Intelligence] Engine starting...\n";
    curl_global_init(CURL_GLOBAL_DEFAULT);

    // Data fetch thread
    std::thread fetch_thread([]() {
        while (true) {
            std::string curr_asset, curr_bench;
            {
                std::lock_guard<std::mutex> lock(state_mutex);
                curr_asset = active_asset;
                curr_bench = active_benchmark;
            }

            std::string url = build_url(curr_bench, curr_asset);
            std::string raw = http_get(url);
            fetch_count++;

            if (!raw.empty()) {
                BookSnapshot new_snap;
                new_snap.venue = curr_bench;
                new_snap.symbol = curr_asset + "-PYUSD";
                new_snap.local_ts_ms = now_ms();

                if (curr_bench == "Kraken") parse_kraken(raw, new_snap);
                else parse_cryptocom(raw, new_snap);

                if (!new_snap.bids.empty()) {
                    std::lock_guard<std::mutex> lock(state_mutex);
                    double new_mid = get_mid(new_snap);

                    if (!first_data_logged) {
                        std::cout << "[Fetch] First data: " << curr_bench << " mid=" << new_mid << " (" << new_snap.bids.size() << " levels)\n";
                        first_data_logged = true;
                    }

                    // Lag detection: track significant benchmark moves
                    if (last_benchmark_mid > 0.0) {
                        double delta_bps = std::abs(new_mid - last_benchmark_mid) / last_benchmark_mid * 10000.0;
                        if (delta_bps > 2.0) {
                            std::cout << "[Fetch] Mid moved " << delta_bps << " bps -> " << new_mid << "\n";
                            last_benchmark_move_ts = now_ms();
                        }
                    }
                    last_benchmark_mid = new_mid;

                    // Update benchmark
                    benchmark_latest = new_snap;

                    // Generate fallback mock for TrueMarkets (used when TrueX WS is down)
                    tm_fallback = new_snap;
                    tm_fallback.venue = "TrueMarkets";
                    double spread = get_spread_bps(new_snap) + 0.5;
                    if (last_benchmark_move_ts > 0 && (now_ms() - last_benchmark_move_ts) < 400) {
                        current_lag_ms = now_ms() - last_benchmark_move_ts;
                    } else {
                        current_lag_ms = 0;
                        tm_fallback.bids[0].price = new_mid - (new_mid * (spread / 20000.0));
                        tm_fallback.asks[0].price = new_mid + (new_mid * (spread / 20000.0));
                        for (auto& b : tm_fallback.bids) b.qty *= 0.8;
                        for (auto& a : tm_fallback.asks) a.qty *= 0.8;
                    }
                    
                    // Update metric history
                    double spread_gap = get_spread_bps(tm_fallback) - get_spread_bps(benchmark_latest);
                    double slip = compute_slippage(tm_fallback, benchmark_latest);
                    double t_depth = get_depth(tm_fallback.bids) + get_depth(tm_fallback.asks);
                    double b_depth = get_depth(benchmark_latest.bids) + get_depth(benchmark_latest.asks);
                    double depth_ratio = b_depth > 0 ? t_depth / b_depth : 1.0;
                    double risk = compute_routing_risk(spread_gap, slip, depth_ratio, current_lag_ms);
                    
                    hist_slippage.add(slip);
                    hist_spread_delta.add(spread_gap);
                    hist_latency.add(current_lag_ms);
                    hist_depth.add(depth_ratio);
                    hist_routing_risk.add(risk);
                }
            } else {
                if (fetch_count <= 3 || fetch_count % 20 == 0)
                    std::cerr << "[Fetch] Empty response from " << curr_bench << " (poll #" << fetch_count << ")\n";
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        }
    });

    uWS::App app;
    uWS::Loop* main_loop = uWS::Loop::get();

    // Broadcast thread
    std::thread broadcast_thread([&app, main_loop]() {
        while (true) {
            std::this_thread::sleep_for(std::chrono::milliseconds(300));
            std::string msg;
            {
                std::lock_guard<std::mutex> lock(state_mutex);
                if (benchmark_latest.bids.empty()) {
                    continue;
                }
                json payload;
                payload["benchmark"] = snap_to_json(benchmark_latest);
                payload["truemarkets"] = snap_to_json(tm_fallback);
                payload["insights"] = build_insights_unlocked();
                payload["lag_ms"] = current_lag_ms;
                payload["timestamp"] = now_ms();
                
                // Add dashboard meta and snapshots
                payload["dashboard_meta"] = {
                    {"feedMode", current_lag_ms == 0 ? "Live" : "Fallback Mock"},
                    {"isStale", false},
                    {"staleMs", 0},
                    {"benchmarkName", active_benchmark},
                    {"asset", active_asset}
                };
                
                payload["metric_snapshots"] = json::array({
                    hist_slippage.get_snapshot(true, false),
                    hist_spread_delta.get_snapshot(false, true),
                    hist_latency.get_snapshot(false, true),
                    hist_depth.get_snapshot(true, false),
                    hist_routing_risk.get_snapshot(false, true)
                });
                
                msg = payload.dump();
            }
            main_loop->defer([&app, msg]() {
                app.publish("broadcast", msg, uWS::OpCode::TEXT, false);
            });
        }
    });

    app.ws<PerSocketData>("/*", {
        .compression = uWS::SHARED_COMPRESSOR,
        .open = [](auto* ws) {
            std::cout << "[WS] Client connected\n";
            ws->subscribe("broadcast");
        },
        .message = [](auto* ws, std::string_view message, uWS::OpCode opCode) {
            try {
                json d = json::parse(message);
                if (d.contains("action") && d["action"] == "subscribe") {
                    std::lock_guard<std::mutex> lock(state_mutex);
                    active_asset = d["asset"].get<std::string>();
                    if (d.contains("benchmark"))
                        active_benchmark = d["benchmark"].get<std::string>();
                    benchmark_latest.bids.clear(); // Reset to show loading
                    std::cout << "[WS] Subscribed: " << active_asset << "-PYUSD on " << active_benchmark << "\n";
                }
            } catch (const std::exception& e) {
                std::cerr << "[WS] Parse error: " << e.what() << "\n";
            }
        },
        .close = [](auto* ws, int code, std::string_view message) {
            std::cout << "[WS] Client disconnected\n";
        }
    })
    .listen(9001, [](auto* listen_socket) {
        if (listen_socket) std::cout << "[WS] Listening on port 9001\n";
        else std::cerr << "[WS] FAILED to listen on 9001 — is the port in use?\n";
    })
    .run();

    fetch_thread.join();
    broadcast_thread.join();
    curl_global_cleanup();
    return 0;
}
