using System.Runtime.InteropServices;

namespace TradingEngineServer.Core.Models;

/// <summary>
/// Classifies the type of event recorded in the deterministic event log.
/// </summary>
public enum EventType : byte
{
    NewOrder = 1,
    CancelOrder = 2,
    TradeExecution = 3
}

/// <summary>
/// A fixed-layout struct representing a single event in the append-only log.
/// Sequential layout with Pack=1 ensures minimal padding for compact binary serialization.
/// Every mutation to the order book is captured as one of these events, enabling
/// deterministic replay identical to LMAX Disruptor / CME Globex audit logs.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public readonly struct EngineEvent
{
    /// <summary>Monotonically increasing sequence number (gap-free).</summary>
    public readonly long SequenceNumber;

    /// <summary>UTC timestamp as DateTime.Ticks for nanosecond-precision ordering.</summary>
    public readonly long TimestampTicks;

    /// <summary>The type of event (NewOrder, CancelOrder, TradeExecution).</summary>
    public readonly EventType Type;

    // --- Order fields (populated for NewOrder / CancelOrder) ---
    public readonly long OrderId;
    public readonly decimal OrderPrice;
    public readonly int OrderSize;
    public readonly bool OrderIsBuy;
    public readonly string? OrderUserId;

    // --- Trade fields (populated for TradeExecution) ---
    public readonly decimal TradePrice;
    public readonly int TradeSize;
    public readonly long MakerOrderId;
    public readonly long TakerOrderId;

    /// <summary>Creates a NewOrder event.</summary>
    public static EngineEvent NewOrder(long seq, in OrderCore order)
    {
        return new EngineEvent(
            seq, DateTime.UtcNow.Ticks, EventType.NewOrder,
            order.OrderId, order.Price, order.Size, order.IsBuy, order.UserId,
            0m, 0, 0, 0);
    }

    /// <summary>Creates a CancelOrder event.</summary>
    public static EngineEvent CancelOrder(long seq, long orderId)
    {
        return new EngineEvent(
            seq, DateTime.UtcNow.Ticks, EventType.CancelOrder,
            orderId, 0m, 0, false, null,
            0m, 0, 0, 0);
    }

    /// <summary>Creates a TradeExecution event.</summary>
    public static EngineEvent TradeExecution(long seq, decimal price, int size, long makerOrderId, long takerOrderId)
    {
        return new EngineEvent(
            seq, DateTime.UtcNow.Ticks, EventType.TradeExecution,
            0, 0m, 0, false, null,
            price, size, makerOrderId, takerOrderId);
    }

    private EngineEvent(long seq, long ticks, EventType type,
        long orderId, decimal orderPrice, int orderSize, bool orderIsBuy, string? orderUserId,
        decimal tradePrice, int tradeSize, long makerOrderId, long takerOrderId)
    {
        SequenceNumber = seq;
        TimestampTicks = ticks;
        Type = type;
        OrderId = orderId;
        OrderPrice = orderPrice;
        OrderSize = orderSize;
        OrderIsBuy = orderIsBuy;
        OrderUserId = orderUserId;
        TradePrice = tradePrice;
        TradeSize = tradeSize;
        MakerOrderId = makerOrderId;
        TakerOrderId = takerOrderId;
    }
}
