#include "OrderBook.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <chrono>
#include <cmath>
#include <numeric>
#include <vector>
#include <deque>
#include <algorithm>
#include <gperftools/profiler.h> // Industry standard C++ Profiler
#include "schema_generated.h"
using namespace ExecutionCoach::Sim;

struct PerfMetrics {
    long long totalOrdersProcessed;
    double maxLatencyUs;
    double avgLatencyUs;
    double totalPnL;
};

struct Candle {
    long long timestamp;
    double open, high, low, close, volume;
};

// ─── Technical Indicator Helpers ────────────────────────────────────────
double calcSMA(const std::deque<double>& prices, int period) {
    if ((int)prices.size() < period) return 0.0;
    double sum = 0;
    for (int i = prices.size() - period; i < (int)prices.size(); i++)
        sum += prices[i];
    return sum / period;
}

double calcEMA(double prevEma, double price, int period) {
    double k = 2.0 / (period + 1);
    return price * k + prevEma * (1.0 - k);
}

double calcRSI(const std::deque<double>& prices, int period) {
    if ((int)prices.size() < period + 1) return 50.0; // neutral
    double gainSum = 0, lossSum = 0;
    for (int i = prices.size() - period; i < (int)prices.size(); i++) {
        double change = prices[i] - prices[i - 1];
        if (change > 0) gainSum += change;
        else lossSum += -change;
    }
    double avgGain = gainSum / period;
    double avgLoss = lossSum / period;
    if (avgLoss == 0) return 100.0;
    double rs = avgGain / avgLoss;
    return 100.0 - (100.0 / (1.0 + rs));
}

double calcStdDev(const std::deque<double>& prices, int period) {
    if ((int)prices.size() < period) return 0.0;
    double mean = calcSMA(prices, period);
    double sq_sum = 0;
    for (int i = prices.size() - period; i < (int)prices.size(); i++) {
        double diff = prices[i] - mean;
        sq_sum += diff * diff;
    }
    return std::sqrt(sq_sum / period);
}

// ─── Read Candle CSV ────────────────────────────────────────────────────
std::vector<Candle> readCandles(const std::string& path) {
    std::vector<Candle> candles;
    std::ifstream file(path);
    if (!file.is_open()) return candles;
    std::string line;
    std::getline(file, line); // skip header
    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string ts, o, h, l, c, v;
        std::getline(ss, ts, ',');
        std::getline(ss, o, ',');
        std::getline(ss, h, ',');
        std::getline(ss, l, ',');
        std::getline(ss, c, ',');
        std::getline(ss, v, ',');
        Candle cd;
        cd.timestamp = std::stoll(ts);
        cd.open = std::stod(o);
        cd.high = std::stod(h);
        cd.low = std::stod(l);
        cd.close = std::stod(c);
        cd.volume = std::stod(v);
        candles.push_back(cd);
    }
    return candles;
}

// ─── Candle-Based Strategy Runner ───────────────────────────────────────
void runCandleStrategy(const std::string& strategyType, const std::vector<Candle>& candles, double aggression) {
    std::vector<double> pnlHistory;
    std::vector<double> pnlReturns;
    double totalPnL = 0;
    double peakPnl = 0, maxDrawdown = 0;
    int winningTrades = 0, totalTrades = 0;
    double totalLatency = 0;
    double maxLatencyUs = 0;

    // State for indicators
    std::deque<double> closePrices;
    double ema12 = 0, ema26 = 0, signalLine = 0;
    bool ema_initialized = false;

    // Position tracking: 0 = flat, 1 = long, -1 = short
    int position = 0;
    double entryPrice = 0;

    for (size_t i = 0; i < candles.size(); i++) {
        auto start = std::chrono::high_resolution_clock::now();
        const Candle& c = candles[i];
        closePrices.push_back(c.close);
        if (closePrices.size() > 200) closePrices.pop_front(); // rolling window

        int signal = 0; // 1 = buy, -1 = sell, 0 = hold

        if (strategyType == "sma_crossover") {
            // SMA 10 / 30 crossover
            if ((int)closePrices.size() >= 30) {
                double smaShort = calcSMA(closePrices, 10);
                double smaLong = calcSMA(closePrices, 30);
                double prevShort = 0, prevLong = 0;
                if ((int)closePrices.size() >= 31) {
                    // Peek back by temporarily removing last
                    double last = closePrices.back();
                    closePrices.pop_back();
                    prevShort = calcSMA(closePrices, 10);
                    prevLong = calcSMA(closePrices, 30);
                    closePrices.push_back(last);
                }
                // Golden cross: short crosses above long
                if (prevShort <= prevLong && smaShort > smaLong) signal = 1;
                // Death cross: short crosses below long
                if (prevShort >= prevLong && smaShort < smaLong) signal = -1;
            }
        } else if (strategyType == "rsi_mean_reversion") {
            if ((int)closePrices.size() >= 15) {
                double rsi = calcRSI(closePrices, 14);
                if (rsi < 30) signal = 1;      // oversold → buy
                else if (rsi > 70) signal = -1; // overbought → sell
            }
        } else if (strategyType == "bollinger_breakout") {
            int period = 20;
            if ((int)closePrices.size() >= period) {
                double sma = calcSMA(closePrices, period);
                double stddev = calcStdDev(closePrices, period);
                double upperBand = sma + 2.0 * stddev;
                double lowerBand = sma - 2.0 * stddev;
                if (c.close <= lowerBand) signal = 1;   // touch lower band → buy
                if (c.close >= upperBand) signal = -1;  // touch upper band → sell
            }
        } else if (strategyType == "macd_signal") {
            if (!ema_initialized && closePrices.size() >= 1) {
                ema12 = c.close;
                ema26 = c.close;
                signalLine = 0;
                ema_initialized = true;
            } else {
                ema12 = calcEMA(ema12, c.close, 12);
                ema26 = calcEMA(ema26, c.close, 26);
                double macd = ema12 - ema26;
                double prevSignal = signalLine;
                signalLine = calcEMA(signalLine, macd, 9);
                // Bullish: MACD crosses above signal
                if (macd > signalLine && (ema12 - ema26) > 0 && i > 26) {
                    double prevMacd = ema12 - ema26; // approximate
                    if (prevSignal >= macd * 0.99) signal = 1;
                }
                // Bearish: MACD crosses below signal
                if (macd < signalLine && i > 26) {
                    signal = -1;
                }
            }
        }

        // Execute trades based on signal
        if (signal == 1 && position <= 0) {
            // Close short if open
            if (position == -1) {
                double pnl = (entryPrice - c.close) * aggression;
                totalPnL += pnl;
                pnlReturns.push_back(pnl);
                totalTrades++;
                if (pnl > 0) winningTrades++;
            }
            // Open long
            position = 1;
            entryPrice = c.close;
        } else if (signal == -1 && position >= 0) {
            // Close long if open
            if (position == 1) {
                double pnl = (c.close - entryPrice) * aggression;
                totalPnL += pnl;
                pnlReturns.push_back(pnl);
                totalTrades++;
                if (pnl > 0) winningTrades++;
            }
            // Open short
            position = -1;
            entryPrice = c.close;
        }

        pnlHistory.push_back(totalPnL);
        if (totalPnL > peakPnl) peakPnl = totalPnL;
        double dd = peakPnl - totalPnL;
        if (dd > maxDrawdown) maxDrawdown = dd;

        auto end = std::chrono::high_resolution_clock::now();
        std::chrono::duration<double, std::micro> elapsed = end - start;
        double lat = elapsed.count();
        totalLatency += lat;
        if (lat > maxLatencyUs) maxLatencyUs = lat;
    }

    // Close any open position at end
    if (position == 1) {
        double pnl = (candles.back().close - entryPrice) * aggression;
        totalPnL += pnl;
        pnlReturns.push_back(pnl);
        totalTrades++;
        if (pnl > 0) winningTrades++;
        pnlHistory.back() = totalPnL;
    } else if (position == -1) {
        double pnl = (entryPrice - candles.back().close) * aggression;
        totalPnL += pnl;
        pnlReturns.push_back(pnl);
        totalTrades++;
        if (pnl > 0) winningTrades++;
        pnlHistory.back() = totalPnL;
    }

    double avgLatency = candles.size() > 0 ? totalLatency / candles.size() : 0;
    double winRate = totalTrades > 0 ? (double)winningTrades / totalTrades : 0;

    // Sharpe Ratio
    double sharpeRatio = 0;
    if (pnlReturns.size() > 1) {
        double sum = std::accumulate(pnlReturns.begin(), pnlReturns.end(), 0.0);
        double mean = sum / pnlReturns.size();
        double sq_sum = std::inner_product(pnlReturns.begin(), pnlReturns.end(), pnlReturns.begin(), 0.0);
        double stdev = std::sqrt(sq_sum / pnlReturns.size() - mean * mean);
        if (stdev > 0) sharpeRatio = (mean / stdev) * std::sqrt(252);
    }

    // Console output
    std::cout << "=== Candle Strategy Backtest Complete ===\n";
    std::cout << "Strategy: " << strategyType << "\n";
    std::cout << "Candles Processed: " << candles.size() << "\n";
    std::cout << "Total Trades: " << totalTrades << "\n";
    std::cout << "Win Rate: " << (winRate * 100) << "%\n";
    std::cout << "Simulated PnL: $" << totalPnL << "\n";
    std::cout << "Sharpe Ratio: " << sharpeRatio << "\n";
    std::cout << "Max Drawdown: $" << maxDrawdown << "\n";

    // Write JSON report
    std::ofstream reportFile("data/backtest_report.json");
    if (reportFile.is_open()) {
        reportFile << "{\n";
        reportFile << "  \"strategy\": \"" << strategyType << "\",\n";
        reportFile << "  \"total_orders\": " << candles.size() << ",\n";
        reportFile << "  \"total_trades\": " << totalTrades << ",\n";
        reportFile << "  \"avg_latency_us\": " << avgLatency << ",\n";
        reportFile << "  \"max_latency_us\": " << maxLatencyUs << ",\n";
        reportFile << "  \"simulated_pnl\": " << totalPnL << ",\n";
        reportFile << "  \"win_rate\": " << winRate << ",\n";
        reportFile << "  \"max_drawdown\": " << maxDrawdown << ",\n";
        reportFile << "  \"sharpe_ratio\": " << sharpeRatio << ",\n";
        reportFile << "  \"pnl_history\": [";
        for (size_t i = 0; i < pnlHistory.size(); ++i) {
            reportFile << pnlHistory[i];
            if (i < pnlHistory.size() - 1) reportFile << ", ";
        }
        reportFile << "]\n";
        reportFile << "}\n";
        reportFile.close();
        std::cout << "Report saved to -> data/backtest_report.json\n";
    }
}

// ─── Orderbook-Based Strategy Runner (original) ─────────────────────────
void runOrderbookStrategy(const std::string& csvPath, const std::string& strategyType,
                          double aggression, double buyThreshold, double sellThreshold) {
    std::ifstream file(csvPath);
    if (!file.is_open()) {
        std::cerr << "Failed to open backtest data file: " << csvPath << "\n";
        return;
    }

    OrderBook ob("BTCUSD");
    PerfMetrics metrics = {0, 0.0, 0.0, 0.0};
    double totalLatency = 0.0;

    std::string line;
    std::getline(file, line); // skip header

    std::vector<double> pnlHistory;
    std::vector<double> pnlReturns;
    double peakPnl = 0.0, maxDrawdown = 0.0;
    int winningTrades = 0, totalTrades = 0;

    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string sideStr, priceStr, amountStr;
        std::getline(ss, sideStr, ',');
        std::getline(ss, priceStr, ',');
        std::getline(ss, amountStr, ',');

        bool isBuy = (sideStr == "buy");
        double price = std::stod(priceStr);
        double size = std::stod(amountStr);

        auto start = std::chrono::high_resolution_clock::now();
        ob.processOrder(isBuy, price, size);
        auto end = std::chrono::high_resolution_clock::now();
        std::chrono::duration<double, std::micro> elapsed = end - start;

        double latency = elapsed.count();
        if (latency > metrics.maxLatencyUs) metrics.maxLatencyUs = latency;
        totalLatency += latency;
        metrics.totalOrdersProcessed++;

        if (metrics.totalOrdersProcessed % 10 == 0) {
            double tick = 0.0;
            if (strategyType == "spread_arbitrage") {
                tick = (ob.getBestAsk() - ob.getBestBid()) * size * 0.1 * aggression;
                if (rand() % 10 > 7) tick = -tick * 0.5;
            } else {
                tick = (isBuy ? price * buyThreshold : -price * sellThreshold) * aggression;
            }
            pnlReturns.push_back(tick);
            metrics.totalPnL += tick;
            pnlHistory.push_back(metrics.totalPnL);

            totalTrades++;
            if (tick > 0) winningTrades++;
            if (metrics.totalPnL > peakPnl) peakPnl = metrics.totalPnL;
            double drawdown = peakPnl - metrics.totalPnL;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }

    if (metrics.totalOrdersProcessed > 0)
        metrics.avgLatencyUs = totalLatency / metrics.totalOrdersProcessed;

    double winRate = (totalTrades > 0) ? (double)winningTrades / totalTrades : 0.0;
    double sharpeRatio = 0.0;
    if (pnlReturns.size() > 1) {
        double sum = std::accumulate(pnlReturns.begin(), pnlReturns.end(), 0.0);
        double mean = sum / pnlReturns.size();
        double sq_sum = std::inner_product(pnlReturns.begin(), pnlReturns.end(), pnlReturns.begin(), 0.0);
        double stdev = std::sqrt(sq_sum / pnlReturns.size() - mean * mean);
        if (stdev > 0) sharpeRatio = (mean / stdev) * std::sqrt(252);
    }

    ob.printSnapshot();
    std::cout << "=== Backtest Complete ===\n";
    std::cout << "Total Orders: " << metrics.totalOrdersProcessed << "\n";
    std::cout << "Simulated Strategy PnL: $" << metrics.totalPnL << "\n";

    std::ofstream reportFile("data/backtest_report.json");
    if (reportFile.is_open()) {
        reportFile << "{\n";
        reportFile << "  \"total_orders\": " << metrics.totalOrdersProcessed << ",\n";
        reportFile << "  \"avg_latency_us\": " << metrics.avgLatencyUs << ",\n";
        reportFile << "  \"max_latency_us\": " << metrics.maxLatencyUs << ",\n";
        reportFile << "  \"simulated_pnl\": " << metrics.totalPnL << ",\n";
        reportFile << "  \"win_rate\": " << winRate << ",\n";
        reportFile << "  \"max_drawdown\": " << maxDrawdown << ",\n";
        reportFile << "  \"sharpe_ratio\": " << sharpeRatio << ",\n";
        reportFile << "  \"final_best_bid\": " << ob.getBestBid() << ",\n";
        reportFile << "  \"final_best_ask\": " << ob.getBestAsk() << ",\n";
        reportFile << "  \"pnl_history\": [";
        for (size_t i = 0; i < pnlHistory.size(); ++i) {
            reportFile << pnlHistory[i];
            if (i < pnlHistory.size() - 1) reportFile << ", ";
        }
        reportFile << "]\n";
        reportFile << "}\n";
        reportFile.close();
        std::cout << "Report saved to -> data/backtest_report.json\n";
    }
}
void runFlatbufferSimulation(const std::string& binPath) {
    std::ifstream infile(binPath, std::ios::binary | std::ios::ate);
    if (!infile) {
        std::cerr << "{\"error\": \"Failed to open bin file\"}\n";
        return;
    }
    std::streamsize size = infile.tellg();
    infile.seekg(0, std::ios::beg);
    std::vector<char> buffer(size);
    if (!infile.read(buffer.data(), size)) {
        std::cerr << "{\"error\": \"Failed to read bin file\"}\n";
        return;
    }

    auto req = GetSimulationRequest(buffer.data());
    auto q = req->current_quote();
    double currentBid = q->bid();
    double currentAsk = q->ask();
    
    // Simulate latency regime logic matching the Python intent
    double executionLatencyFactor = 1.0;
    if (req->latency() == LatencyRegime_Medium) executionLatencyFactor = 1.8;
    else if (req->latency() == LatencyRegime_Stressed) executionLatencyFactor = 3.5;

    double sizeMultiplier = req->size_usd() / 10000.0;
    double baselineSpread = std::abs(currentAsk - currentBid);
    
    double simulatedCost = 0.0;
    double simulatedRisk = 0.0;
    
    OrderBook ob("BTCUSD");
    ob.processOrder(true, currentBid, 10);
    ob.processOrder(false, currentAsk, 10);
    
    auto start = std::chrono::high_resolution_clock::now();
    ob.processOrder(req->side(), req->side() ? currentAsk : currentBid, req->size_usd());
    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::micro> elapsed = end - start;
    
    if (req->mode() == ExecutionMode_ExecuteNow) {
        simulatedCost = (sizeMultiplier * baselineSpread) * executionLatencyFactor;
        simulatedRisk = (req->latency() != LatencyRegime_Nominal) ? 80 : 30;
    } else if (req->mode() == ExecutionMode_Slice) {
        simulatedCost = ((sizeMultiplier * 0.4) * baselineSpread) + (executionLatencyFactor * 5);
        simulatedRisk = 20 + (executionLatencyFactor * 10);
    } else { // Defensive
        simulatedCost = baselineSpread + (executionLatencyFactor * 15);
        simulatedRisk = 5;
    }

    // Force risk cap guard locally in C++ RAM logic
    if (req->inventory_usd() + req->size_usd() > 100000.0) {
        simulatedRisk += 100; // Penalize drastically
    }
    
    // Send single JSON block to STDOUT for Python API proxy to pick up. Zero-copy IPC approach via Popen.
    std::cout << "{\n"
              << "  \"mode\": " << (int)req->mode() << ",\n"
              << "  \"simulatedCost\": " << simulatedCost << ",\n"
              << "  \"simulatedRisk\": " << simulatedRisk << ",\n"
              << "  \"latencyUs\": " << elapsed.count() << "\n"
              << "}\n";
}

// ─── Main ───────────────────────────────────────────────────────────────
int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <path_to_csv> [strategy_type] [aggression] [buy_threshold] [sell_threshold]\n";
        return 1;
    }

    if (argc >= 2 && std::string(argv[1]).find(".bin") != std::string::npos) {
        // Flatbuffers Direct Execution Mode
        runFlatbufferSimulation(argv[1]);
        return 0;
    }

    std::string csvPath = argv[1];
    std::string strategyType = (argc >= 3) ? argv[2] : "momentum";
    double aggression = (argc >= 4) ? std::stod(argv[3]) : 1.0;
    double buyThreshold = (argc >= 5) ? std::stod(argv[4]) : 0.0001;
    double sellThreshold = (argc >= 6) ? std::stod(argv[5]) : 0.0001;

    std::cout << "Starting high-performance backtest engine...\n";
    std::cout << "Strategy: " << strategyType << " | Aggression: " << aggression << "\n";

    ProfilerStart("backtester.prof");

    // Candle-based famous strategies
    if (strategyType == "sma_crossover" || strategyType == "rsi_mean_reversion" ||
        strategyType == "bollinger_breakout" || strategyType == "macd_signal") {
        auto candles = readCandles(csvPath);
        if (candles.empty()) {
            std::cerr << "No candle data found in: " << csvPath << "\n";
            ProfilerStop();
            return 1;
        }
        std::cout << "Loaded " << candles.size() << " candles.\n";
        
        // Loop 1000x to build a dense CPU profile without reading from disk on every iteration
        std::cout << "Profiling loop 1,000 times...\n";
        for(int i=0; i<1000; i++) {
            runCandleStrategy(strategyType, candles, aggression);
        }
    } else {
        // Original orderbook-based strategies
        std::cout << "Profiling loop 1,000 times...\n";
        for(int i=0; i<1000; i++) {
            runOrderbookStrategy(csvPath, strategyType, aggression, buyThreshold, sellThreshold);
        }
    }

    ProfilerStop();
    std::cout << "Profiling complete. Output saved to backtester.prof\n";

    return 0;
}
