using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using TradingEngineServer.Core.Hubs;
using TradingEngineServer.Core.Poker.Models;
using TradingEngineServer.Core.Poker.Services;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Core.Poker.Endpoints;

/// <summary>
/// Clean separation of poker REST endpoints into a static mapping class.
/// Each endpoint delegates to PokerGameEngine for logic and SignalR for broadcasts.
/// </summary>
public static class PokerEndpoints
{
    // Per-room deck storage (needed across multiple phases of a hand)
    private static readonly ConcurrentDictionary<string, IDeck> _roomDecks = new();

    public static void Map(WebApplication app, ConcurrentDictionary<string, PokerRoom> pokerRooms)
    {
        // ── Create Room ──
        app.MapPost("/api/poker/rooms", async (HttpRequest req, RedisService redisService) =>
        {
            var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
            var userId = doc.GetProperty("userId").GetString()!;

            var roomId = Guid.NewGuid().ToString("N")[..4].ToUpper();
            var room = new PokerRoom
            {
                RoomId = roomId,
                HostUserId = userId
            };

            // Initialize player wallet if needed and get balance
            await redisService.InitializeUserAsync(userId);
            var balances = await redisService.GetUserBalancesAsync(userId);
            double buyIn = Math.Min(balances.GetValueOrDefault("USD", 0), 500);

            room.Players.Add(new PokerPlayer
            {
                UserId = userId,
                SeatIndex = 0,
                ChipCount = buyIn
            });

            pokerRooms.TryAdd(roomId, room);
            return Results.Ok(FilterRoomForPlayer(room, userId));
        });

        // ── Join Room ──
        app.MapPost("/api/poker/rooms/{roomId}/join", async (string roomId, HttpRequest req,
            IHubContext<TradingHub> hub, RedisService redisService) =>
        {
            var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
            var userId = doc.GetProperty("userId").GetString()!;

            if (!pokerRooms.TryGetValue(roomId.ToUpper(), out var room))
                return Results.NotFound(new { error = "Room not found." });

            if (room.Players.Count >= room.MaxPlayers)
                return Results.BadRequest(new { error = "Room is full." });

            if (room.Players.Any(p => p.UserId == userId))
            {
                // Already in room, just return state
                await BroadcastPokerState(room, hub);
                return Results.Ok(FilterRoomForPlayer(room, userId));
            }

            await redisService.InitializeUserAsync(userId);
            var balances = await redisService.GetUserBalancesAsync(userId);
            double buyIn = Math.Min(balances.GetValueOrDefault("USD", 0), 500);

            room.Players.Add(new PokerPlayer
            {
                UserId = userId,
                SeatIndex = room.Players.Count,
                ChipCount = buyIn
            });

            await BroadcastPokerState(room, hub);
            return Results.Ok(FilterRoomForPlayer(room, userId));
        });

        // ── Get Room State ──
        app.MapGet("/api/poker/rooms/{roomId}", (string roomId, HttpRequest req) =>
        {
            if (!pokerRooms.TryGetValue(roomId.ToUpper(), out var room))
                return Results.NotFound();

            var userId = req.Query["userId"].ToString();
            return Results.Ok(FilterRoomForPlayer(room, userId));
        });

        // ── Start Hand (Deal) ──
        app.MapPost("/api/poker/rooms/{roomId}/start", async (string roomId,
            IHubContext<TradingHub> hub) =>
        {
            if (!pokerRooms.TryGetValue(roomId.ToUpper(), out var room))
                return Results.NotFound();

            if (room.Players.Count < 2)
                return Results.BadRequest(new { error = "Need at least 2 players." });

            var deck = new StandardDeck();
            _roomDecks[roomId.ToUpper()] = deck;

            PokerGameEngine.StartHand(room, deck);

            await BroadcastPokerState(room, hub);
            return Results.Ok(new { message = "Hand started." });
        });

        // ── Player Action ──
        app.MapPost("/api/poker/rooms/{roomId}/action", async (string roomId, HttpRequest req,
            IHubContext<TradingHub> hub) =>
        {
            var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
            var userId = doc.GetProperty("userId").GetString()!;
            var actionStr = doc.GetProperty("action").GetString()!;
            double raiseAmount = 0;
            if (doc.TryGetProperty("amount", out var amtEl))
                raiseAmount = amtEl.GetDouble();

            if (!pokerRooms.TryGetValue(roomId.ToUpper(), out var room))
                return Results.NotFound();

            if (!Enum.TryParse<PokerAction>(actionStr, true, out var action))
                return Results.BadRequest(new { error = "Invalid action." });

            try
            {
                bool handContinues = PokerGameEngine.HandleAction(room, userId, action, raiseAmount);

                // If phase advanced, deal community cards
                if (handContinues && room.Phase is PokerPhase.Flop or PokerPhase.Turn or PokerPhase.River)
                {
                    if (_roomDecks.TryGetValue(roomId.ToUpper(), out var deck))
                    {
                        // Only deal if we haven't already dealt for this phase
                        int expectedCards = room.Phase switch
                        {
                            PokerPhase.Flop => 3,
                            PokerPhase.Turn => 4,
                            PokerPhase.River => 5,
                            _ => 0
                        };
                        if (room.CommunityCards.Count < expectedCards)
                        {
                            PokerGameEngine.DealCommunityCards(room, deck);
                        }
                    }
                }

                await BroadcastPokerState(room, hub);
                return Results.Ok(FilterRoomForPlayer(room, userId));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // ── Leave Room ──
        app.MapPost("/api/poker/rooms/{roomId}/leave", async (string roomId, HttpRequest req,
            IHubContext<TradingHub> hub) =>
        {
            var doc = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
            var userId = doc.GetProperty("userId").GetString()!;

            if (!pokerRooms.TryGetValue(roomId.ToUpper(), out var room))
                return Results.NotFound();

            var player = room.Players.FirstOrDefault(p => p.UserId == userId);
            if (player != null)
            {
                room.Players.Remove(player);
            }

            if (room.Players.Count == 0)
            {
                pokerRooms.TryRemove(roomId.ToUpper(), out _);
                _roomDecks.TryRemove(roomId.ToUpper(), out _);
            }
            else
            {
                await BroadcastPokerState(room, hub);
            }

            return Results.Ok();
        });
    }

    // ──────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────

    /// <summary>
    /// Broadcast room state to all connected clients.
    /// Each player receives a filtered view where only their own hole cards are visible.
    /// </summary>
    private static async Task BroadcastPokerState(PokerRoom room, IHubContext<TradingHub> hub)
    {
        // Send each player their personalized view
        foreach (var player in room.Players)
        {
            var filtered = FilterRoomForPlayer(room, player.UserId);
            await hub.Clients.All.SendAsync("PokerStateUpdated", filtered);
        }
    }

    /// <summary>
    /// Create a view of the room where only the requesting player's hole cards are visible.
    /// At showdown, all remaining players' cards are revealed.
    /// </summary>
    private static object FilterRoomForPlayer(PokerRoom room, string requestingUserId)
    {
        bool isShowdown = room.Phase == PokerPhase.Showdown;

        var filteredPlayers = room.Players.Select(p => new
        {
            userId = p.UserId,
            seatIndex = p.SeatIndex,
            chipCount = p.ChipCount,
            currentBet = p.CurrentBet,
            hasFolded = p.HasFolded,
            isAllIn = p.IsAllIn,
            hasActed = p.HasActed,
            // Only show hole cards to the player themselves, or at showdown for active players
            holeCards = (p.UserId == requestingUserId || (isShowdown && !p.HasFolded))
                ? p.HoleCards.Select(c => new { rank = c.RankSymbol, suit = c.SuitSymbol, display = c.Display, color = c.Color }).ToList()
                : (object)new List<object>(), // Empty list — cards are face down
            handDescription = room.PlayerHandDescriptions.GetValueOrDefault(p.UserId, "")
        }).ToList();

        return new
        {
            roomId = room.RoomId,
            hostUserId = room.HostUserId,
            players = filteredPlayers,
            communityCards = room.CommunityCards.Select(c => new { rank = c.RankSymbol, suit = c.SuitSymbol, display = c.Display, color = c.Color }).ToList(),
            phase = room.Phase.ToString(),
            pot = room.Pot,
            currentBet = room.CurrentBet,
            smallBlind = room.SmallBlind,
            bigBlind = room.BigBlind,
            dealerIndex = room.DealerIndex,
            activePlayerIndex = room.ActivePlayerIndex,
            activePlayerUserId = room.ActivePlayer?.UserId ?? "",
            winnerUserIds = room.WinnerUserIds,
            winningHandDescription = room.WinningHandDescription,
            handLog = room.HandLog.TakeLast(10).ToList(),
            forPlayer = requestingUserId
        };
    }
}
