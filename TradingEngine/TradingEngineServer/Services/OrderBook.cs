using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Services;

public interface IOrderBook
{
    void AddOrder(in OrderCore order);
    OrderBookSnapshot GetSnapshot();
    event Action<Trade>? OnTrade;
    event Action<OrderBookSnapshot>? OnBookUpdated;
}

public class OrderBook : IOrderBook
{
    private readonly string _symbol;
    
    // Using List<OrderCore> to hold structs. Since structs are value types, 
    // modifying their size requires assigning the updated struct back to the list point.
    private readonly SortedDictionary<decimal, List<OrderCore>> _bids = new(Comparer<decimal>.Create((a, b) => b.CompareTo(a)));
    private readonly SortedDictionary<decimal, List<OrderCore>> _asks = new();
    
    private readonly object _lock = new();

    public event Action<Trade>? OnTrade;
    public event Action<OrderBookSnapshot>? OnBookUpdated;

    public OrderBook(string symbol)
    {
        _symbol = symbol;
    }

    public void AddOrder(in OrderCore order)
    {
        // For processing, we take a copy we can modify
        var workingOrder = order;

        lock (_lock)
        {
            MatchOrder(ref workingOrder);

            if (workingOrder.Size > 0)
            {
                if (workingOrder.IsBuy)
                {
                    if (!_bids.ContainsKey(workingOrder.Price))
                        _bids[workingOrder.Price] = new List<OrderCore>();
                    _bids[workingOrder.Price].Add(workingOrder);
                }
                else
                {
                    if (!_asks.ContainsKey(workingOrder.Price))
                        _asks[workingOrder.Price] = new List<OrderCore>();
                    _asks[workingOrder.Price].Add(workingOrder);
                }
            }
        }
        
        OnBookUpdated?.Invoke(GetSnapshot());
    }

    private void MatchOrder(ref OrderCore incomingOrder)
    {
        var bookToMatchAgainst = incomingOrder.IsBuy ? _asks : _bids;
        
        while (incomingOrder.Size > 0 && bookToMatchAgainst.Count > 0)
        {
            var bestPriceLevel = bookToMatchAgainst.First();
            var bestPrice = bestPriceLevel.Key;
            var ordersAtLevel = bestPriceLevel.Value;

            // Check if prices cross
            if (incomingOrder.IsBuy && incomingOrder.Price < bestPrice) break;
            if (!incomingOrder.IsBuy && incomingOrder.Price > bestPrice) break;

            while (incomingOrder.Size > 0 && ordersAtLevel.Count > 0)
            {
                var restingOrder = ordersAtLevel[0];
                int tradeSize = Math.Min(incomingOrder.Size, restingOrder.Size);

                // Execute trade: To simulate zero-allocation trade generation, 
                // in an actual ULL system we would use a TradeRingBuffer.
                // For simplicity here, we still allocate `Trade` so the frontend works.
                var trade = new Trade
                {
                    Symbol = _symbol,
                    Price = bestPrice,
                    Size = tradeSize,
                    MakerOrderId = restingOrder.OrderId.ToString(),
                    TakerOrderId = incomingOrder.OrderId.ToString(),
                    Timestamp = DateTime.UtcNow
                };
                
                OnTrade?.Invoke(trade);

                // Update sizes on working struct copies
                incomingOrder = new OrderCore(incomingOrder.OrderId, incomingOrder.Price, incomingOrder.Size - tradeSize, incomingOrder.IsBuy);
                var updatedResting = new OrderCore(restingOrder.OrderId, restingOrder.Price, restingOrder.Size - tradeSize, restingOrder.IsBuy);

                if (updatedResting.Size == 0)
                {
                    ordersAtLevel.RemoveAt(0);
                }
                else
                {
                    // Since it's a struct, replace the item in the list if it has remaining size
                    ordersAtLevel[0] = updatedResting;
                }
            }

            if (ordersAtLevel.Count == 0)
            {
                bookToMatchAgainst.Remove(bestPrice);
            }
        }
    }

    public OrderBookSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            return new OrderBookSnapshot
            {
                Symbol = _symbol,
                Bids = _bids.Select(kvp => new PriceLevel { Price = kvp.Key, Size = kvp.Value.Sum(o => o.Size) }).ToList(),
                Asks = _asks.Select(kvp => new PriceLevel { Price = kvp.Key, Size = kvp.Value.Sum(o => o.Size) }).ToList()
            };
        }
    }
}
