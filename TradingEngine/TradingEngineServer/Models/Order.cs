namespace TradingEngineServer.Core.Models;

public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Symbol { get; set; } = string.Empty;
    public bool IsBuy { get; set; }
    public decimal Price { get; set; }
    public int Size { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
