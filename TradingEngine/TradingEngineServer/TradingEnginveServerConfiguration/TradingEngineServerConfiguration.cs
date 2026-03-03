namespace TradingEngineServer.Core.Configuration
{
    public class TradingEngineServerConfiguration
    {
        public required TradingEngineServerSettings TradingEngineServerSettings { get; set; }
    }

    public class TradingEngineServerSettings
    {
        public int Port { get; set; }
    }
}