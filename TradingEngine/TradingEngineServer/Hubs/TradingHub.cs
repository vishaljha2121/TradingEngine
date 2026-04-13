using Microsoft.AspNetCore.SignalR;
using TradingEngineServer.Core.Models;

namespace TradingEngineServer.Core.Hubs;

public class TradingHub : Hub
{
    // Clients can subscribe to specific symbol updates if needed,
    // but for simplicity we will broadcast to all connected clients.

    /// <summary>Join a poker room's SignalR group for scoped broadcasts.</summary>
    public async Task JoinPokerRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"poker-{roomId}");
    }

    /// <summary>Leave a poker room's SignalR group.</summary>
    public async Task LeavePokerRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"poker-{roomId}");
    }
}
