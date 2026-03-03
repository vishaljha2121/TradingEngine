using System.Threading.Channels;
using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;
using TradingEngineServer.Core.Hubs;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.WebHost.UseUrls("http://localhost:12000");
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000") // Vite 2 default port
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Zero-Allocation memory pool
var ringBuffer = new OrderRingBuffer(1_000_000); // Pre-allocate 1M orders
builder.Services.AddSingleton(ringBuffer);

// We will simulate a single symbol "BTCUSD" for this visualizer.
builder.Services.AddSingleton<IOrderBook>(new OrderBook("BTCUSD"));

builder.Services.AddHostedService<TradingEngineBackgroundService>();

var app = builder.Build();

app.UseCors();

// REST API endpoint to receive orders from the frontend
app.MapPost("/api/orders", (Order order, OrderRingBuffer buffer) =>
{
    // Generate an arbitrary numerical ID for the struct. 
    // Usually this comes from the Exchange Gateway matching engine directly.
    long orderId = DateTime.UtcNow.Ticks;
    
    // Explicit conversion to ULL Cache-Aligned Struct. This is the last allocation.
    var workingOrder = new OrderCore(orderId, order.Price, order.Size, order.IsBuy);
    
    // Write synchronously to lock-free buffer
    if(!buffer.TryWrite(in workingOrder))
    {
         return Results.StatusCode(429); // Too Many Requests if buffer full
    }
    
    return Results.Accepted();
});

// SignalR endpoint for real-time frontend WebSocket connection
app.MapHub<TradingHub>("/tradinghub");

// --- Demo Pipeline Endpoints ---
app.MapPost("/api/run-backtest", async () =>
{
    try
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            Arguments = "-c \"./run_demo.sh\"", // Ensure run_demo.sh is executable
            WorkingDirectory = "/Users/vishaljha/Desktop/TradingEngineServer/TradingEngine",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process == null)
            return Results.StatusCode(500);

        string output = await process.StandardOutput.ReadToEndAsync();
        string error = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
            return Results.BadRequest(new { error = error, output = output });

        return Results.Ok(new { result = output });
    }
    catch (Exception ex)
    {
        return Results.StatusCode(500);
    }
});

// Execute parameterized strategy and return JSON telemetry directly
app.MapPost("/api/run-custom-strategy", async (HttpRequest req) =>
{
    try
    {
        using var reader = new StreamReader(req.Body);
        var body = await reader.ReadToEndAsync();
        var document = System.Text.Json.JsonDocument.Parse(body);
        var root = document.RootElement;
        
        string symbol = root.TryGetProperty("symbol", out var sEl) ? sEl.GetString() ?? "btcusd" : "btcusd";
        string strategyType = root.TryGetProperty("strategyType", out var stEl) ? stEl.GetString() ?? "momentum" : "momentum";
        string aggr = root.TryGetProperty("aggression", out var aEl) ? aEl.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture) : "1.0";
        string buy = root.TryGetProperty("buyThreshold", out var bEl) ? bEl.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture) : "0.0001";
        string sell = root.TryGetProperty("sellThreshold", out var sellEl) ? sellEl.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture) : "0.0001";
        string timeframe = root.TryGetProperty("timeframe", out var tfEl) ? tfEl.GetString() ?? "1h" : "1h";

        var startInfo = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            Arguments = $"-c \"./run_custom_strategy.sh {symbol} {strategyType} {aggr} {buy} {sell} {timeframe}\"",
            WorkingDirectory = "/Users/vishaljha/Desktop/TradingEngineServer/TradingEngine",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process == null) return Results.StatusCode(500);

        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
        {
            string error = await process.StandardError.ReadToEndAsync();
            return Results.BadRequest(new { error = error });
        }

        // Read the resulting JSON file generated by C++
        string jsonReport = await File.ReadAllTextAsync("/Users/vishaljha/Desktop/TradingEngineServer/TradingEngine/data/backtest_report.json");
        return Results.Content(jsonReport, "application/json");
    }
    catch (Exception ex)
    {
        return Results.StatusCode(500);
    }
});

// Run AI Insights independently of the backtester
app.MapPost("/api/ai-feedback", async () =>
{
    try
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "python3",
            Arguments = "scripts/ai_reviewer.py",
            WorkingDirectory = "/Users/vishaljha/Desktop/TradingEngineServer/TradingEngine",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process == null) return Results.StatusCode(500);

        string output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();

        return Results.Ok(new { result = output });
    }
    catch (Exception ex)
    {
        return Results.StatusCode(500);
    }
});

// Fetch Live Market Data Orderbook from Gemini
app.MapGet("/api/marketdata/{symbol}", async (string symbol) =>
{
    try
    {
        using var client = new HttpClient();
        var response = await client.GetAsync($"https://api.gemini.com/v1/book/{symbol}?limit_bids=50&limit_asks=50");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        return Results.Content(json, "application/json");
    }
    catch (Exception ex)
    {
        return Results.Problem($"Failed to fetch market data: {ex.Message}");
    }
});

app.Run();
