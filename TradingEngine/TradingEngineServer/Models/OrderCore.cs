using System.Runtime.InteropServices;

namespace TradingEngineServer.Core.Models;

/// <summary>
/// A cache-aligned struct representing the core data of an order.
/// 64 bytes is the standard cache line size on x86/ARM CPUs.
/// Explicit layout prevents false sharing when multiple threads access adjacent memory.
/// </summary>
[StructLayout(LayoutKind.Explicit, Size = 64)]
public readonly struct OrderCore
{
    // Offset 0: Order ID (using a long instead of a string/Guid to avoid heap allocations)
    [FieldOffset(0)]
    public readonly long OrderId;

    // Offset 8: Price (decimal is 16 bytes in C#, so this spans offset 8 to 23)
    [FieldOffset(8)]
    public readonly decimal Price;

    // Offset 24: Size (int is 4 bytes)
    [FieldOffset(24)]
    public readonly int Size;

    // Offset 28: IsBuy (bool is 1 byte)
    [FieldOffset(28)]
    public readonly bool IsBuy;

    // Offset 29-36: We can store a truncated 8-character UserId string,
    // For this simulation, we'll just use a string reference.
    [FieldOffset(32)]
    public readonly string UserId;

    public OrderCore(long orderId, decimal price, int size, bool isBuy, string userId)
    {
        OrderId = orderId;
        Price = price;
        Size = size;
        IsBuy = isBuy;
        UserId = userId;
    }
}
