using FluentAssertions;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class OrderRingBufferTests
{
    [Fact]
    public void TryWrite_Should_Add_Order_When_Not_Full()
    {
        // Arrange
        var buffer = new OrderRingBuffer(2); // capacity is effectively size-1 because tail == head means empty
        var order = new OrderCore(1, 100m, 10, true, "User1");

        // Act
        var result = buffer.TryWrite(in order);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void TryWrite_Should_Return_False_When_Full()
    {
        // Arrange
        var buffer = new OrderRingBuffer(3); // Can hold at most 2 items
        var order1 = new OrderCore(1, 100m, 10, true, "User1");
        var order2 = new OrderCore(2, 100m, 10, true, "User2");
        var order3 = new OrderCore(3, 100m, 10, true, "User3");

        buffer.TryWrite(in order1).Should().BeTrue();
        buffer.TryWrite(in order2).Should().BeTrue();

        // Act
        var result = buffer.TryWrite(in order3);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void TryRead_Should_Return_False_When_Empty()
    {
        // Arrange
        var buffer = new OrderRingBuffer(10);

        // Act
        var result3 = buffer.TryRead(out var order3);
        result3.Should().BeFalse();
        order3.Should().Be(default(OrderCore));
    }

    [Fact]
    public void TryRead_Should_Retrieve_Orders_In_FIFO_Order()
    {
        // Arrange
        var buffer = new OrderRingBuffer(10);
        var order1 = new OrderCore(1, 100m, 10, true, "User1");
        var order2 = new OrderCore(2, 200m, 20, false, "User2");

        buffer.TryWrite(in order1);
        buffer.TryWrite(in order2);

        // Act & Assert
        var result1 = buffer.TryRead(out var readOrder1);
        result1.Should().BeTrue();
        readOrder1.OrderId.Should().Be(1);
        readOrder1.Price.Should().Be(100m);

        var result2 = buffer.TryRead(out var readOrder2);
        result2.Should().BeTrue();
        readOrder2.OrderId.Should().Be(2);
        readOrder2.Price.Should().Be(200m);

        var result3 = buffer.TryRead(out _);
        result3.Should().BeFalse();
    }
}
