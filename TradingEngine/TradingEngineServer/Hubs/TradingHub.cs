using Microsoft.AspNetCore.SignalR;
using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Hubs;

public class TradingHub : Hub
{
    // Clients can subscribe to specific symbol updates if needed,
    // but for simplicity we will broadcast to all connected clients.
}
