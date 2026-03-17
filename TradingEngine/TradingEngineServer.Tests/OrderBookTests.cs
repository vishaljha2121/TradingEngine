using FluentAssertions;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class OrderBookTests
{
    private const string Symbol = "BTCUSD";

    [Fact]
    public void AddOrder_Should_Add_To_Bids_When_IsBuy_True()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        var order = new OrderCore(1, 100m, 10, true, "User1");

        // Act
        orderBook.AddOrder(in order);

        // Assert
        var snapshot = orderBook.GetSnapshot();
        snapshot.Symbol.Should().Be(Symbol);
        snapshot.Asks.Should().BeEmpty();
        snapshot.Bids.Should().HaveCount(1);
        snapshot.Bids[0].Price.Should().Be(100m);
        snapshot.Bids[0].Size.Should().Be(10);
    }

    [Fact]
    public void AddOrder_Should_Add_To_Asks_When_IsBuy_False()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        var order = new OrderCore(1, 100m, 10, false, "User1");

        // Act
        orderBook.AddOrder(in order);

        // Assert
        var snapshot = orderBook.GetSnapshot();
        snapshot.Symbol.Should().Be(Symbol);
        snapshot.Bids.Should().BeEmpty();
        snapshot.Asks.Should().HaveCount(1);
        snapshot.Asks[0].Price.Should().Be(100m);
        snapshot.Asks[0].Size.Should().Be(10);
    }

    [Fact]
    public void AddOrder_Should_Match_Crossing_Orders_And_Emit_Trade()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        var makerOrder = new OrderCore(1, 100m, 10, true, "User1");
        var takerOrder = new OrderCore(2, 90m, 5, false, "User2"); // Taker selling at lower price than bid
        orderBook.AddOrder(in makerOrder);

        Trade? emittedTrade = null;
        orderBook.OnTrade += trade => emittedTrade = trade;

        // Act
        orderBook.AddOrder(in takerOrder);

        // Assert
        emittedTrade.Should().NotBeNull();
        emittedTrade!.Price.Should().Be(100m); // Matches at maker price
        emittedTrade.Size.Should().Be(5);
        emittedTrade.MakerIsBuy.Should().BeTrue();
        emittedTrade.MakerUserId.Should().Be("User1");
        emittedTrade.TakerUserId.Should().Be("User2");

        var snapshot = orderBook.GetSnapshot();
        snapshot.Bids.Should().HaveCount(1);
        snapshot.Bids[0].Size.Should().Be(5); // 10 - 5 = 5 remaining
        snapshot.Asks.Should().BeEmpty(); // Taker was fully filled
    }

    [Fact]
    public void AddOrder_Should_Match_Fully_Crossing_Order()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        var makerOrder = new OrderCore(1, 100m, 5, true, "User1");
        var takerOrder = new OrderCore(2, 90m, 10, false, "User2"); // Taker selling more than resting
        orderBook.AddOrder(in makerOrder);

        // Act
        orderBook.AddOrder(in takerOrder);

        // Assert
        var snapshot = orderBook.GetSnapshot();
        snapshot.Bids.Should().BeEmpty(); // Maker fully filled and removed
        snapshot.Asks.Should().HaveCount(1);
        snapshot.Asks[0].Size.Should().Be(5); // Taker has 5 remaining, rests as ask at 90m
        snapshot.Asks[0].Price.Should().Be(90m);
    }

    [Fact]
    public void CancelOrder_Should_Remove_Resting_Order()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        var order1 = new OrderCore(1, 100m, 10, true, "User1");
        var order2 = new OrderCore(2, 110m, 5, false, "User2");
        orderBook.AddOrder(in order1);
        orderBook.AddOrder(in order2);

        // Act
        var result1 = orderBook.CancelOrder(1);
        var result2 = orderBook.CancelOrder(99); // Non-existent order

        // Assert
        result1.Should().BeTrue();
        result2.Should().BeFalse();

        var snapshot = orderBook.GetSnapshot();
        snapshot.Bids.Should().BeEmpty(); // Order 1 removed
        snapshot.Asks.Should().HaveCount(1); // Order 2 remains
        snapshot.Asks[0].Size.Should().Be(5);
    }

    [Fact]
    public void Reset_Should_Clear_Book()
    {
        // Arrange
        var orderBook = new OrderBook(Symbol);
        orderBook.AddOrder(new OrderCore(1, 100m, 10, true, "User1"));
        orderBook.AddOrder(new OrderCore(2, 110m, 5, false, "User2"));

        // Act
        orderBook.Reset();

        // Assert
        var snapshot = orderBook.GetSnapshot();
        snapshot.Bids.Should().BeEmpty();
        snapshot.Asks.Should().BeEmpty();
    }
}
