using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using TradingEngineServer.Core.Hubs;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class TradingEngineBackgroundServiceTests : IDisposable
{
    private readonly string _testDirPath;

    public TradingEngineBackgroundServiceTests()
    {
        _testDirPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
    }

    public void Dispose()
    {
        if (Directory.Exists(_testDirPath))
        {
            Directory.Delete(_testDirPath, recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_Should_Consume_Orders_And_Publish_Events()
    {
        // Arrange
        var mockLogger = new Mock<ILogger<TradingEngineBackgroundService>>();
        var ringBuffer = new OrderRingBuffer(10);
        
        var mockOrderBook = new Mock<IOrderBook>();
        mockOrderBook.Setup(ob => ob.GetSnapshot()).Returns(new OrderBookSnapshot 
        { 
            Symbol = "BTCUSD", 
            Bids = new List<PriceLevel>(), 
            Asks = new List<PriceLevel>() 
        });
        
        var mockHubContext = new Mock<IHubContext<TradingHub>>();
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);

        var mockMultiplexer = new Mock<IConnectionMultiplexer>();
        var mockDb = new Mock<IDatabase>();
        mockMultiplexer.Setup(m => m.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
        var redisService = new RedisService(mockMultiplexer.Object);

        using var eventLogger = new EventLogger(_testDirPath);

        // We use a real RingBuffer but mocked OrderBook, Hub, and Redis.
        var service = new TradingEngineBackgroundService(
            mockLogger.Object,
            ringBuffer,
            mockOrderBook.Object,
            mockHubContext.Object,
            redisService,
            eventLogger
        );

        // Act
        // Start the background service
        var cts = new CancellationTokenSource();
        var processTask = service.StartAsync(cts.Token);

        // Write an order to the ring buffer
        var order = new OrderCore(999, 1000m, 5, true, "Alice");
        ringBuffer.TryWrite(in order);

        // Give the background thread ample time to process
        await Task.Delay(1000);

        // Stop the background service
        cts.Cancel();
        await service.StopAsync(CancellationToken.None);

        // Assert
        // The order should have been popped from buffer and passed to AddOrder
        mockOrderBook.Verify(ob => ob.AddOrder(ref It.Ref<OrderCore>.IsAny), Times.Once);
        
        // The event should have been logged
        eventLogger.GetEventCount().Should().Be(1);
        
        // A latency metric should have been broadcast to SignalR clients
        mockClientProxy.Verify(c => c.SendCoreAsync("ReceiveMetrics", It.Is<object[]>(args => args.Length > 0), default), Times.AtLeastOnce);
    }
}
