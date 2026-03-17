using FluentAssertions;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class EventLoggerTests : IDisposable
{
    private readonly string _testDirPath;

    public EventLoggerTests()
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
    public void EventLogger_Should_Append_And_Read_NewOrder()
    {
        // Arrange
        using var logger = new EventLogger(_testDirPath);
        var order = new OrderCore(123, 68000m, 5, true, "Alice");

        // Act
        var loggedEvent = logger.LogNewOrder(in order);
        var allEvents = logger.GetAllEvents();

        // Assert
        loggedEvent.Type.Should().Be(EventType.NewOrder);
        loggedEvent.OrderId.Should().Be(123);
        loggedEvent.OrderUserId.Should().Be("Alice");

        allEvents.Should().HaveCount(1);
        var readEvent = allEvents[0];
        readEvent.Type.Should().Be(EventType.NewOrder);
        readEvent.OrderId.Should().Be(123);
        readEvent.OrderPrice.Should().Be(68000m);
        readEvent.OrderSize.Should().Be(5);
        readEvent.OrderIsBuy.Should().BeTrue();
        readEvent.OrderUserId.Should().Be("Alice");
    }

    [Fact]
    public void EventLogger_Should_Append_And_Read_CancelOrder()
    {
        // Arrange
        using var logger = new EventLogger(_testDirPath);

        // Act
        var loggedEvent = logger.LogCancelOrder(456);
        var allEvents = logger.GetAllEvents();

        // Assert
        loggedEvent.Type.Should().Be(EventType.CancelOrder);
        loggedEvent.OrderId.Should().Be(456);

        allEvents.Should().HaveCount(1);
        var readEvent = allEvents[0];
        readEvent.Type.Should().Be(EventType.CancelOrder);
        readEvent.OrderId.Should().Be(456);
        readEvent.OrderSize.Should().Be(0); // Assuming 0 as default for cancel
        readEvent.OrderPrice.Should().Be(0m);
    }

    [Fact]
    public void EventLogger_Should_Append_And_Read_TradeExecution()
    {
        // Arrange
        using var logger = new EventLogger(_testDirPath);

        // Act
        var loggedEvent = logger.LogTradeExecution(67500m, 3, 111, 222);
        var allEvents = logger.GetAllEvents();

        // Assert
        loggedEvent.Type.Should().Be(EventType.TradeExecution);
        loggedEvent.TradePrice.Should().Be(67500m);
        loggedEvent.TradeSize.Should().Be(3);
        loggedEvent.MakerOrderId.Should().Be(111);
        loggedEvent.TakerOrderId.Should().Be(222);

        allEvents.Should().HaveCount(1);
        var readEvent = allEvents[0];
        readEvent.Type.Should().Be(EventType.TradeExecution);
        readEvent.TradePrice.Should().Be(67500m);
        readEvent.TradeSize.Should().Be(3);
        readEvent.MakerOrderId.Should().Be(111);
        readEvent.TakerOrderId.Should().Be(222);
    }

    [Fact]
    public void Clear_Should_Truncate_Log_And_Reset_Sequence()
    {
        // Arrange
        using var logger = new EventLogger(_testDirPath);
        logger.LogCancelOrder(1);
        logger.LogCancelOrder(2);
        logger.GetEventCount().Should().Be(2);

        // Act
        logger.Clear();

        // Assert
        logger.GetEventCount().Should().Be(0);
        
        // Log a new event to verify sequence resetted to 0
        var evt = logger.LogCancelOrder(3);
        evt.SequenceNumber.Should().Be(0);
    }

    [Fact]
    public void EventLogger_Should_Maintain_State_Across_Instances()
    {
        // Arrange
        using (var logger1 = new EventLogger(_testDirPath))
        {
            logger1.LogCancelOrder(1);
        } // logger1 disposed, file flushed/closed

        using (var logger2 = new EventLogger(_testDirPath))
        {
            // Act
            var events = logger2.GetAllEvents();
            var newEvt = logger2.LogCancelOrder(2);

            // Assert
            events.Should().HaveCount(1);
            events[0].OrderId.Should().Be(1);
            newEvt.SequenceNumber.Should().Be(1); // Continuing sequence
        }
    }
}
