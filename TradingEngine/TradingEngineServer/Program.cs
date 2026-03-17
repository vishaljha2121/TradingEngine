using System.Threading.Channels;
using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;
using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using TradingEngineServer.Core;
using StackExchange.Redis;
using TradingEngineServer.Core.Hubs;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.WebHost.UseUrls("http://0.0.0.0:12000");
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // Allow any LAN origin
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Redis (abortConnect=false allows startup without Redis)
var redisConnList = "127.0.0.1:6379,abortConnect=false";
var multiplexer = ConnectionMultiplexer.Connect(redisConnList);
builder.Services.AddSingleton<IConnectionMultiplexer>(multiplexer);
builder.Services.AddSingleton<RedisService>();

// Configure Zero-Allocation memory pool
var ringBuffer = new OrderRingBuffer(1_000_000); // Pre-allocate 1M orders
builder.Services.AddSingleton(ringBuffer);

// We will simulate a single symbol "BTCUSD" for this visualizer.
builder.Services.AddSingleton<IOrderBook>(new OrderBook("BTCUSD"));

// Deterministic Replay Engine: Event Logger + Replay
var eventLogDir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data");
builder.Services.AddSingleton(new EventLogger(eventLogDir));
builder.Services.AddSingleton<ReplayEngine>();

builder.Services.AddHostedService<TradingEngineBackgroundService>();

// GLOBAL MEMORY FOR MULTIPLAYER GAME ROOMS
var gameRooms = new ConcurrentDictionary<string, GameRoom>();
var EVENT_TYPES = new string[] { "Frog Jump", "Coin Flip", "Rocket Launch", "Cat Mood", "Weather Forecast" };
var EVENT_OPTIONS = new Dictionary<string, string[]> {
    { "Frog Jump", new[] { "LEFT", "RIGHT" } },
    { "Coin Flip", new[] { "HEADS", "TAILS" } },
    { "Rocket Launch", new[] { "ORBIT", "CRASH" } },
    { "Cat Mood", new[] { "SLEEPY", "CRAZY" } },
    { "Weather Forecast", new[] { "SUNNY", "RAINY" } }
};

var app = builder.Build();

app.UseCors();

// REST API endpoint to login a user and fetch/initialize wallet
app.MapPost("/api/users/login", async (HttpRequest req, RedisService redisService) =>
{
    var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
    if (doc.TryGetProperty("userId", out var userIdEl))
    {
        var userId = userIdEl.GetString();
        if (string.IsNullOrEmpty(userId)) return Results.BadRequest();
        
        await redisService.InitializeUserAsync(userId);
        var balances = await redisService.GetUserBalancesAsync(userId);
        return Results.Ok(new { userId = userId, balances = balances });
    }
    return Results.BadRequest();
});

// ADMIN REST API endpoint to get all users
app.MapGet("/api/admin/users", async (HttpRequest req, RedisService redisService) =>
{
    if (!req.Headers.TryGetValue("Admin-Password", out var pass) || pass != "supersecret123")
    {
        return Results.Unauthorized();
    }
    
    var users = await redisService.GetAllUsersAsync();
    return Results.Ok(users);
});

// ADMIN REST API endpoint to delete a user
app.MapDelete("/api/admin/users/{userId}", async (HttpRequest req, string userId, RedisService redisService) =>
{
    if (!req.Headers.TryGetValue("Admin-Password", out var pass) || pass != "supersecret123")
    {
        return Results.Unauthorized();
    }
    
    await redisService.DeleteUserAsync(userId);
    return Results.Ok();
});

// --- MULTIPLAYER GAME ROOM ENDPOINTS ---

app.MapPost("/api/game/rooms", async (HttpRequest req) =>
{
    using var reader = new StreamReader(req.Body);
    var body = await reader.ReadToEndAsync();
    var doc = JsonDocument.Parse(body);
    var hostId = doc.RootElement.GetProperty("userId").GetString();

    var roomId = Guid.NewGuid().ToString("N").Substring(0, 4).ToUpper();
    var room = new GameRoom { RoomId = roomId, HostUserId = hostId, State = "WAITING" };
    room.Players.Add(hostId);
    
    gameRooms.TryAdd(roomId, room);
    return Results.Ok(room);
});

app.MapPost("/api/game/rooms/{roomId}/join", async (string roomId, HttpRequest req, Microsoft.AspNetCore.SignalR.IHubContext<TradingHub> hub, RedisService redisService) =>
{
    using var reader = new StreamReader(req.Body);
    var body = await reader.ReadToEndAsync();
    var doc = JsonDocument.Parse(body);
    var userId = doc.RootElement.GetProperty("userId").GetString();

    if (gameRooms.TryGetValue(roomId.ToUpper(), out var room))
    {
        if (!room.Players.Contains(userId)) room.Players.Add(userId);
        await ProgramHelpers.BroadcastRoomState(roomId, room, hub, redisService);
        return Results.Ok(room);
    }
    return Results.NotFound();
});

app.MapPost("/api/game/rooms/{roomId}/start", async (string roomId, Microsoft.AspNetCore.SignalR.IHubContext<TradingHub> hub, RedisService redisService) =>
{
    if (gameRooms.TryGetValue(roomId.ToUpper(), out var room))
    {
        room.Bets.Clear();
        var random = new Random();
        room.CurrentEvent = EVENT_TYPES[random.Next(EVENT_TYPES.Length)];
        room.State = "BETTING";
        await ProgramHelpers.BroadcastRoomState(roomId, room, hub, redisService);
        return Results.Ok(room);
    }
    return Results.NotFound();
});

app.MapPost("/api/game/rooms/{roomId}/bet", async (string roomId, HttpRequest req, Microsoft.AspNetCore.SignalR.IHubContext<TradingHub> hub, RedisService redisService) =>
{
    var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
    var userId = doc.GetProperty("userId").GetString();
    var prediction = doc.GetProperty("prediction").GetString();

    if (gameRooms.TryGetValue(roomId.ToUpper(), out var room))
    {
        room.Bets[userId] = prediction;
        await ProgramHelpers.BroadcastRoomState(roomId, room, hub, redisService);
        
        // If everyone has bet, simulate!
        if (room.Bets.Count == room.Players.Count)
        {
            await ProgramHelpers.SimulateGameRound(roomId, room, hub, redisService, null, EVENT_OPTIONS);
        }
        return Results.Ok(room);
    }
    return Results.NotFound();
});

// ADMIN "GOD MODE" ENDPOINT to rig the game
app.MapPost("/api/game/rooms/{roomId}/rig", async (string roomId, HttpRequest req, Microsoft.AspNetCore.SignalR.IHubContext<TradingHub> hub, RedisService redisService) =>
{
    var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
    var riggedOutcome = doc.GetProperty("outcome").GetString();

    if (gameRooms.TryGetValue(roomId.ToUpper(), out var room))
    {
        await ProgramHelpers.SimulateGameRound(roomId, room, hub, redisService, riggedOutcome, EVENT_OPTIONS);
        return Results.Ok(room);
    }
    return Results.NotFound();
});
// Global JSON Serializer Options for maximum performance without allocations
var jsonOptions = new System.Text.Json.JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true
};

// REST API endpoint to receive orders from the frontend
app.MapPost("/api/orders", async (HttpRequest req, OrderRingBuffer buffer, RedisService redisService) =>
{
    var order = await JsonSerializer.DeserializeAsync<TradingEngineServer.Core.Models.Order>(req.Body, jsonOptions);
    if (order == null) return Results.BadRequest();
    // Generate an arbitrary numerical ID for the struct. 
    long orderId = DateTime.UtcNow.Ticks;
    
    // Explicit conversion to ULL Cache-Aligned Struct. This is the last allocation.
    var workingOrder = new OrderCore(orderId, order.Price, order.Size, order.IsBuy, order.UserId);
    
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

// --- Deterministic Replay Engine Endpoints ---

app.MapGet("/api/events", (EventLogger logger) =>
{
    var events = logger.GetAllEvents();
    var result = events.Select(e => new
    {
        seq = e.SequenceNumber,
        timestamp = new DateTime(e.TimestampTicks, DateTimeKind.Utc).ToString("o"),
        type = e.Type.ToString(),
        orderId = e.OrderId,
        orderPrice = e.OrderPrice,
        orderSize = e.OrderSize,
        orderIsBuy = e.OrderIsBuy,
        orderUserId = e.OrderUserId,
        tradePrice = e.TradePrice,
        tradeSize = e.TradeSize,
        makerOrderId = e.MakerOrderId,
        takerOrderId = e.TakerOrderId
    });
    return Results.Ok(result);
});

app.MapGet("/api/events/count", (EventLogger logger) =>
{
    return Results.Ok(new { count = logger.GetEventCount() });
});

app.MapPost("/api/replay", (EventLogger logger, ReplayEngine replayEngine, IOrderBook orderBook) =>
{
    var events = logger.GetAllEvents();
    var result = replayEngine.Replay(events, orderBook);
    return Results.Ok(result);
});

app.MapDelete("/api/events", (EventLogger logger) =>
{
    logger.Clear();
    return Results.Ok(new { message = "Event log cleared." });
});

app.Run();

#nullable disable
// To allow integration testing
public partial class Program { }
public class GameRoom 
{
    public string RoomId { get; set; }
    public string HostUserId { get; set; }
    public List<string> Players { get; set; } = new List<string>();
    public Dictionary<string, double> PlayerBalances { get; set; } = new Dictionary<string, double>();
    public string State { get; set; } // WAITING, BETTING, RESOLVED
    public string CurrentEvent { get; set; }
    public string WinningOption { get; set; }
    public Dictionary<string, string> Bets { get; set; } = new Dictionary<string, string>();
}
#nullable enable

public static partial class ProgramHelpers {
    public static async Task SimulateGameRound(string roomId, GameRoom room, Microsoft.AspNetCore.SignalR.IHubContext<TradingEngineServer.Core.Hubs.TradingHub> hub, RedisService redisService, string riggedOutcome, Dictionary<string, string[]> EVENT_OPTIONS)
    {
        var options = EVENT_OPTIONS[room.CurrentEvent];
        string winningOption = riggedOutcome ?? options[new Random().Next(options.Length)];
        
        foreach (var bet in room.Bets)
        {
            if (bet.Value == winningOption)
                await redisService.AdjustBalanceAsync(bet.Key, 10);
            else
                await redisService.AdjustBalanceAsync(bet.Key, -10);
        }
        
        room.State = "RESOLVED";
        room.WinningOption = winningOption;
        await BroadcastRoomState(roomId, room, hub, redisService);
        await hub.Clients.All.SendAsync("GameResolved", new { RoomId = roomId, WinningOption = winningOption });
    }

    public static async Task BroadcastRoomState(string roomId, GameRoom room, Microsoft.AspNetCore.SignalR.IHubContext<TradingEngineServer.Core.Hubs.TradingHub> hub, RedisService redisService)
    {
        room.PlayerBalances.Clear();
        foreach(var p in room.Players) {
            if (p == "ADMIN") {
                room.PlayerBalances[p] = 999999.0;
            } else {
                var bal = await redisService.GetUserBalancesAsync(p);
                room.PlayerBalances[p] = bal.ContainsKey("USD") ? (double)bal["USD"] : 0.0;
            }
        }
        await hub.Clients.All.SendAsync("RoomStateUpdated", room);
    }
}
