namespace TradingEngineServer.Core.Models;

public class OrderBookSnapshot
{
    public string Symbol { get; set; } = string.Empty;
    public List<PriceLevel> Bids { get; set; } = new();
    public List<PriceLevel> Asks { get; set; } = new();
}

public class PriceLevel
{
    public decimal Price { get; set; }
    public int Size { get; set; }
}
