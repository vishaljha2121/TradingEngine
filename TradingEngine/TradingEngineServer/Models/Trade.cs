namespace TradingEngineServer.Core.Models;

public class Trade
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Symbol { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Size { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string MakerOrderId { get; set; } = string.Empty;
    public string TakerOrderId { get; set; } = string.Empty;
    public string MakerUserId { get; set; } = string.Empty;
    public string TakerUserId { get; set; } = string.Empty;
    public bool MakerIsBuy { get; set; }
}
