using System.Diagnostics;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradingEngineServer.Core.Hubs;
using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Services;

public class TradingEngineBackgroundService : BackgroundService
{
    private readonly ILogger<TradingEngineBackgroundService> _logger;
    private readonly OrderRingBuffer _ringBuffer;
    private readonly IOrderBook _orderBook;
    private readonly IHubContext<TradingHub> _hubContext;
    private readonly RedisService _redisService;

    public static int ActiveCoreId { get; private set; } = -1;

    public TradingEngineBackgroundService(
        ILogger<TradingEngineBackgroundService> logger,
        OrderRingBuffer ringBuffer,
        IOrderBook orderBook,
        IHubContext<TradingHub> hubContext,
        RedisService redisService)
    {
        _logger = logger;
        _ringBuffer = ringBuffer;
        _orderBook = orderBook;
        _hubContext = hubContext;
        _redisService = redisService;

        _orderBook.OnTrade += HandleTrade;
        _orderBook.OnBookUpdated += HandleBookUpdated;
    }

    private void HandleTrade(Trade trade)
    {
        _hubContext.Clients.All.SendAsync("ReceiveTrade", trade);
        
        // Find out who is buyer and who is seller
        string buyerId = trade.MakerIsBuy ? trade.MakerUserId : trade.TakerUserId;
        string sellerId = trade.MakerIsBuy ? trade.TakerUserId : trade.MakerUserId;

        _ = Task.Run(async () =>
        {
            try
            {
                await _redisService.SettleTradeAsync(buyerId, sellerId, trade.Price, trade.Size);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to settle trade in Redis");
            }
        });
    }

    private void HandleBookUpdated(OrderBookSnapshot snapshot)
    {
        _hubContext.Clients.All.SendAsync("OrderBookUpdated", snapshot);
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // We avoid await/async in the core loop to maximize performance
        // and create our own dedicated long-running thread instead.
        var thread = new Thread(() => RunEngineLoop(stoppingToken))
        {
            Name = "TradingEngineCoreLoop",
            IsBackground = true,
            Priority = ThreadPriority.Highest
        };

        thread.Start();
        return Task.CompletedTask;
    }

    private void RunEngineLoop(CancellationToken stoppingToken)
    {
        // CPU Optimizations: Lock Thread to to a single logical core (Core Affinity)
        try
        {
            if (OperatingSystem.IsWindows() || OperatingSystem.IsLinux())
            {
                Thread.BeginThreadAffinity();
                var processThread = Process.GetCurrentProcess().Threads
                    .Cast<ProcessThread>()
                    .FirstOrDefault(t => t.Id == Environment.CurrentManagedThreadId);

                if (processThread != null)
                {
                    // Bitmask for affinity. E.g. processor 1 = 1<<0 = 1, processor 2 = 1<<1 = 2...
                    // Pinning to the highest available core to avoid OS interference.
                    int processorCount = Environment.ProcessorCount;
                    int targetCore = processorCount - 1; 
                    long affinityMask = 1L << targetCore;
                    
                    try 
                    {
                        processThread.ProcessorAffinity = (IntPtr)affinityMask;
                        ActiveCoreId = targetCore;
                        _logger.LogInformation($"[OPTIMIZATION] Core Engine Thread pinned to CPU Core {targetCore}.");
                    }
                    catch 
                    {
                        // Fallback if OS denies permission
                        ActiveCoreId = -1;
                        _logger.LogWarning($"[OPTIMIZATION] Could not pin thread to core {targetCore}. Operating System may have restricted access.");
                    }
                }
            }
            else
            {
                 ActiveCoreId = -1; // Not supported on macOS
                 _logger.LogInformation($"[OPTIMIZATION] Core Affinity is bypassed on this OS ({Environment.OSVersion}).");
            }
        }
        catch(Exception ex)
        {
             _logger.LogWarning(ex, "Failed to apply Thread Affinity.");
        }

        _logger.LogInformation("Trading Engine Loop Started.");
        HandleBookUpdated(_orderBook.GetSnapshot());

        var spinWait = new SpinWait();

        // Hot Path: Spin-wait loop replaces asynchronous yield to avoid latency jitter
        while (!stoppingToken.IsCancellationRequested)
        {
            if (_ringBuffer.TryRead(out OrderCore order))
            {
                // Measure simulation latency at the engine consumption layer
                long startTicks = Stopwatch.GetTimestamp();
                
                _orderBook.AddOrder(in order);
                
                long endTicks = Stopwatch.GetTimestamp();
                double microseconds = (endTicks - startTicks) * 1_000_000.0 / Stopwatch.Frequency;
                
                // Fire and forget metric update
                _ = _hubContext.Clients.All.SendAsync("ReceiveMetrics", new { 
                    latencyUs = microseconds,
                    allocations = 0, // Simulated Zero-Allocation path
                    coreId = ActiveCoreId
                }); 
            }
            else
            {
                // Engine is idle. In a true kernel-bypass system we never yield (spin 100%).
                // For this demo application we will use SpinOnce to prevent computer lockup.
                spinWait.SpinOnce();
            }
        }

        Thread.EndThreadAffinity();
        _logger.LogInformation("Trading Engine Loop Stopped.");
    }
}
