using System.Threading.Channels;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
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

app.Run();
