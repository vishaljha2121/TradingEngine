namespace TradingEngineServer.Core.Poker.Models;

public enum PokerPhase
{
    Waiting,    // Lobby — waiting for players or next hand
    PreFlop,    // Hole cards dealt, first betting round
    Flop,       // 3 community cards, second betting round
    Turn,       // 4th community card, third betting round
    River,      // 5th community card, final betting round
    Showdown    // Reveal hands, determine winner
}

public enum PokerAction
{
    Fold,
    Check,
    Call,
    Raise
}

/// <summary>
/// Complete state of a poker table/room. Holds all information needed
/// to render the game on any client and to resume game logic.
/// </summary>
public class PokerRoom
{
    public string RoomId { get; set; } = string.Empty;
    public string HostUserId { get; set; } = string.Empty;
    public List<PokerPlayer> Players { get; set; } = new();
    public List<Card> CommunityCards { get; set; } = new();
    public PokerPhase Phase { get; set; } = PokerPhase.Waiting;

    // Betting state
    public double Pot { get; set; }
    public double CurrentBet { get; set; }
    public double SmallBlind { get; set; } = 5;
    public double BigBlind { get; set; } = 10;
    public double MinBuyIn { get; set; } = 100;

    // Position tracking
    public int DealerIndex { get; set; }
    public int ActivePlayerIndex { get; set; } = -1;

    // Showdown results (populated after showdown)
    public List<string> WinnerUserIds { get; set; } = new();
    public string WinningHandDescription { get; set; } = string.Empty;
    public Dictionary<string, string> PlayerHandDescriptions { get; set; } = new();

    // Game log for the current hand
    public List<string> HandLog { get; set; } = new();

    public int MaxPlayers => 8;

    /// <summary>Returns the player whose turn it is, or null if no active player.</summary>
    public PokerPlayer? ActivePlayer =>
        ActivePlayerIndex >= 0 && ActivePlayerIndex < Players.Count
            ? Players[ActivePlayerIndex]
            : null;

    /// <summary>Players still in the hand (not folded).</summary>
    public List<PokerPlayer> ActivePlayers =>
        Players.Where(p => p.IsActiveInHand).ToList();

    public void ResetForNewHand()
    {
        CommunityCards.Clear();
        Pot = 0;
        CurrentBet = 0;
        ActivePlayerIndex = -1;
        WinnerUserIds.Clear();
        WinningHandDescription = string.Empty;
        PlayerHandDescriptions.Clear();
        HandLog.Clear();
        Phase = PokerPhase.Waiting;

        foreach (var player in Players)
        {
            player.ResetForNewHand();
        }
    }
}
