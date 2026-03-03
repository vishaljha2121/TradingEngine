using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Services;

/// <summary>
/// A simplistic pre-allocated Ring Buffer (array-backed) to simulate DPDK/Kernel bypass memory models.
/// Prevents GC pressure by allocating memory entirely upfront.
/// </summary>
public class OrderRingBuffer
{
    private readonly OrderCore[] _buffer;
    private readonly int _capacity;
    private int _head;
    private int _tail;

    public OrderRingBuffer(int capacity)
    {
        _capacity = capacity;
        _buffer = new OrderCore[capacity];
        _head = 0;
        _tail = 0;
    }

    public bool TryWrite(in OrderCore order)
    {
        int nextTail = (_tail + 1) % _capacity;
        if (nextTail == _head)
        {
            // Buffer is full
            return false;
        }

        _buffer[_tail] = order;
        _tail = nextTail;
        return true;
    }

    public bool TryRead(out OrderCore order)
    {
        if (_head == _tail)
        {
            // Buffer is empty
            order = default;
            return false;
        }

        order = _buffer[_head];
        _head = (_head + 1) % _capacity;
        return true;
    }
}
