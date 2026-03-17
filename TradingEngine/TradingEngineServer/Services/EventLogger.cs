using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Services;

/// <summary>
/// Append-only binary event logger. Every order book mutation is serialized to 
/// data/events.log so the full engine state can be deterministically replayed.
/// Thread-safe — the hot-path lock is scoped to a single BinaryWriter.Flush.
/// </summary>
public class EventLogger : IDisposable
{
    private readonly string _logPath;
    private readonly object _lock = new();
    private long _sequenceNumber;
    private BinaryWriter? _writer;
    private FileStream? _stream;

    public EventLogger(string logDirectory)
    {
        Directory.CreateDirectory(logDirectory);
        _logPath = Path.Combine(logDirectory, "events.log");
        OpenWriter();
    }

    private void OpenWriter()
    {
        _stream = new FileStream(_logPath, FileMode.Append, FileAccess.Write, FileShare.Read);
        _writer = new BinaryWriter(_stream);
        
        // If log already has data, determine the current sequence number
        if (File.Exists(_logPath))
        {
            var events = ReadAllEventsInternal();
            _sequenceNumber = events.Count > 0 ? events[^1].SequenceNumber + 1 : 0;
        }
    }

    /// <summary>Log a NewOrder event.</summary>
    public EngineEvent LogNewOrder(in OrderCore order)
    {
        lock (_lock)
        {
            var evt = EngineEvent.NewOrder(_sequenceNumber++, in order);
            WriteEvent(in evt);
            return evt;
        }
    }

    /// <summary>Log a CancelOrder event.</summary>
    public EngineEvent LogCancelOrder(long orderId)
    {
        lock (_lock)
        {
            var evt = EngineEvent.CancelOrder(_sequenceNumber++, orderId);
            WriteEvent(in evt);
            return evt;
        }
    }

    /// <summary>Log a TradeExecution event.</summary>
    public EngineEvent LogTradeExecution(decimal price, int size, long makerOrderId, long takerOrderId)
    {
        lock (_lock)
        {
            var evt = EngineEvent.TradeExecution(_sequenceNumber++, price, size, makerOrderId, takerOrderId);
            WriteEvent(in evt);
            return evt;
        }
    }

    private void WriteEvent(in EngineEvent evt)
    {
        if (_writer == null) return;

        _writer.Write(evt.SequenceNumber);
        _writer.Write(evt.TimestampTicks);
        _writer.Write((byte)evt.Type);
        _writer.Write(evt.OrderId);
        _writer.Write(evt.OrderPrice);
        _writer.Write(evt.OrderSize);
        _writer.Write(evt.OrderIsBuy);
        _writer.Write(evt.OrderUserId ?? string.Empty);
        _writer.Write(evt.TradePrice);
        _writer.Write(evt.TradeSize);
        _writer.Write(evt.MakerOrderId);
        _writer.Write(evt.TakerOrderId);
        _writer.Flush();
    }

    /// <summary>Read all events from the log file.</summary>
    public List<EngineEvent> GetAllEvents()
    {
        lock (_lock)
        {
            return ReadAllEventsInternal();
        }
    }

    private List<EngineEvent> ReadAllEventsInternal()
    {
        var events = new List<EngineEvent>();
        if (!File.Exists(_logPath)) return events;

        try
        {
            using var fs = new FileStream(_logPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new BinaryReader(fs);
            
            while (fs.Position < fs.Length)
            {
                try
                {
                    long seq = reader.ReadInt64();
                    long ticks = reader.ReadInt64();
                    var type = (EventType)reader.ReadByte();
                    long orderId = reader.ReadInt64();
                    decimal orderPrice = reader.ReadDecimal();
                    int orderSize = reader.ReadInt32();
                    bool orderIsBuy = reader.ReadBoolean();
                    string orderUserId = reader.ReadString();
                    decimal tradePrice = reader.ReadDecimal();
                    int tradeSize = reader.ReadInt32();
                    long makerOrderId = reader.ReadInt64();
                    long takerOrderId = reader.ReadInt64();

                    EngineEvent evt = type switch
                    {
                        EventType.NewOrder => EngineEvent.NewOrder(seq, 
                            new OrderCore(orderId, orderPrice, orderSize, orderIsBuy, orderUserId)),
                        EventType.CancelOrder => EngineEvent.CancelOrder(seq, orderId),
                        EventType.TradeExecution => EngineEvent.TradeExecution(seq, tradePrice, tradeSize, makerOrderId, takerOrderId),
                        _ => EngineEvent.NewOrder(seq, default)
                    };

                    events.Add(evt);
                }
                catch (EndOfStreamException)
                {
                    break;
                }
            }
        }
        catch (IOException)
        {
            // File might be in use; return what we have
        }

        return events;
    }

    /// <summary>Returns the total number of events in the log.</summary>
    public int GetEventCount()
    {
        return GetAllEvents().Count;
    }

    /// <summary>Truncates the event log and resets the sequence counter.</summary>
    public void Clear()
    {
        lock (_lock)
        {
            _writer?.Dispose();
            _stream?.Dispose();
            
            if (File.Exists(_logPath))
                File.WriteAllBytes(_logPath, Array.Empty<byte>());
            
            _sequenceNumber = 0;
            OpenWriter();
        }
    }

    public void Dispose()
    {
        _writer?.Dispose();
        _stream?.Dispose();
    }
}
