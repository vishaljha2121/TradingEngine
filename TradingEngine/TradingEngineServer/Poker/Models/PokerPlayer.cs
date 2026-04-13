namespace TradingEngineServer.Core.Poker.Models;

/// <summary>
/// Represents a player's state within a single poker hand.
/// Mutable by design — the game engine mutates this as the hand progresses.
/// </summary>
public class PokerPlayer
{
    public string UserId { get; set; } = string.Empty;
    public int SeatIndex { get; set; }
    public double ChipCount { get; set; }
    public double CurrentBet { get; set; }
    public double TotalBetThisHand { get; set; }
    public List<Card> HoleCards { get; set; } = new();
    public bool HasFolded { get; set; }
    public bool HasActed { get; set; }
    public bool IsAllIn { get; set; }
    public bool IsConnected { get; set; } = true;

    /// <summary>Whether this player is still active in the current hand.</summary>
    public bool IsActiveInHand => !HasFolded && ChipCount >= 0;

    public void ResetForNewHand()
    {
        HoleCards.Clear();
        CurrentBet = 0;
        TotalBetThisHand = 0;
        HasFolded = false;
        HasActed = false;
        IsAllIn = false;
    }

    public void ResetForNewBettingRound()
    {
        CurrentBet = 0;
        HasActed = false;
    }
}
