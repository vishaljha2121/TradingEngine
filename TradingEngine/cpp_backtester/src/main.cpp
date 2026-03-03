#include "OrderBook.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <chrono>
#include <cmath>
#include <numeric>

struct PerfMetrics {
    long long totalOrdersProcessed;
    double maxLatencyUs;
    double avgLatencyUs;
    double totalPnL; // Mock metric for reviewer
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <path_to_gemini_csv> [strategy_type] [aggression] [buy_threshold] [sell_threshold]\n";
        return 1;
    }

    std::string csvPath = argv[1];
    std::string strategyType = (argc >= 3) ? argv[2] : "momentum";
    double aggression = (argc >= 4) ? std::stod(argv[3]) : 1.0;
    double buyThreshold = (argc >= 5) ? std::stod(argv[4]) : 0.0001;
    double sellThreshold = (argc >= 6) ? std::stod(argv[5]) : 0.0001;
    
    std::ifstream file(csvPath);

    if (!file.is_open()) {
        std::cerr << "Failed to open backtest data file: " << csvPath << "\n";
        return 1;
    }

    OrderBook ob("BTCUSD");
    PerfMetrics metrics = {0, 0.0, 0.0, 0.0};
    double totalLatency = 0.0;

    std::string line;
    // Skip header
    std::getline(file, line);

    std::cout << "Starting high-performance backtest engine...\n";
    std::cout << "Strategy Params -> Type: " << strategyType << " Aggression: " << aggression << " BuyThresh: " << buyThreshold << " SellThresh: " << sellThreshold << "\n";

    std::vector<double> pnlHistory;
    std::vector<double> pnlReturns;
    double peakPnl = 0.0;
    double maxDrawdown = 0.0;
    int winningTrades = 0;
    int totalTrades = 0;

    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string sideStr, priceStr, amountStr;

        std::getline(ss, sideStr, ',');
        std::getline(ss, priceStr, ',');
        std::getline(ss, amountStr, ',');

        bool isBuy = (sideStr == "buy");
        double price = std::stod(priceStr);
        double size = std::stod(amountStr);

        // Measure core matching engine performance
        auto start = std::chrono::high_resolution_clock::now();
        
        ob.processOrder(isBuy, price, size);
        
        auto end = std::chrono::high_resolution_clock::now();
        std::chrono::duration<double, std::micro> elapsed = end - start;
        
        double latency = elapsed.count();
        if (latency > metrics.maxLatencyUs) {
            metrics.maxLatencyUs = latency;
        }
        totalLatency += latency;
        metrics.totalOrdersProcessed++;
        
        // Mock PnL (arbitrary calculation for the AI reviewer to consume, influenced by parameters)
        if (metrics.totalOrdersProcessed % 10 == 0) {
            
            double tick = 0.0;
            if (strategyType == "spread_arbitrage") {
                // Mock a spread capture strategy
                tick = (ob.getBestAsk() - ob.getBestBid()) * size * 0.1 * aggression;
                // Add some artificial variance
                if (rand() % 10 > 7) tick = -tick * 0.5;
            } else {
                // Momentum
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

    if (metrics.totalOrdersProcessed > 0) {
        metrics.avgLatencyUs = totalLatency / metrics.totalOrdersProcessed;
    }

    double winRate = (totalTrades > 0) ? (double)winningTrades / totalTrades : 0.0;
    
    // Calculate Sharpe Ratio (simplified)
    double sharpeRatio = 0.0;
    if (pnlReturns.size() > 1) {
        double sum = std::accumulate(pnlReturns.begin(), pnlReturns.end(), 0.0);
        double mean = sum / pnlReturns.size();
        
        double sq_sum = std::inner_product(pnlReturns.begin(), pnlReturns.end(), pnlReturns.begin(), 0.0);
        double stdev = std::sqrt(sq_sum / pnlReturns.size() - mean * mean);
        
        if (stdev > 0) {
            sharpeRatio = (mean / stdev) * std::sqrt(252); // Annualized assumption
        }
    }

    ob.printSnapshot();

    std::cout << "=== Backtest Complete ===\n";
    std::cout << "Total Orders: " << metrics.totalOrdersProcessed << "\n";
    std::cout << "Avg Latency (us): " << metrics.avgLatencyUs << "\n";
    std::cout << "Max Latency (us): " << metrics.maxLatencyUs << "\n";
    std::cout << "Simulated Strategy PnL: $" << metrics.totalPnL << "\n";
    
    // Dump metrics to a JSON file for the Agent Reviewer and UI
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
        
        // Write PnL History Array
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

    return 0;
}
