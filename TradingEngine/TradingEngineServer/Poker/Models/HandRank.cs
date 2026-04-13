namespace TradingEngineServer.Core.Poker.Models;

public enum HandRankCategory
{
    HighCard,
    OnePair,
    TwoPair,
    ThreeOfAKind,
    Straight,
    Flush,
    FullHouse,
    FourOfAKind,
    StraightFlush,
    RoyalFlush
}

/// <summary>
/// Immutable result of evaluating a 5-card hand.
/// Kickers are ordered descending for tie-breaking.
/// </summary>
public record HandResult(HandRankCategory Category, List<int> Kickers) : IComparable<HandResult>
{
    public int CompareTo(HandResult? other)
    {
        if (other is null) return 1;

        int categoryComparison = Category.CompareTo(other.Category);
        if (categoryComparison != 0) return categoryComparison;

        // Same category — compare kickers left to right
        for (int i = 0; i < Math.Min(Kickers.Count, other.Kickers.Count); i++)
        {
            int kickerComparison = Kickers[i].CompareTo(other.Kickers[i]);
            if (kickerComparison != 0) return kickerComparison;
        }

        return 0; // Exact tie
    }

    public string Description => Category switch
    {
        HandRankCategory.RoyalFlush => "Royal Flush",
        HandRankCategory.StraightFlush => "Straight Flush",
        HandRankCategory.FourOfAKind => "Four of a Kind",
        HandRankCategory.FullHouse => "Full House",
        HandRankCategory.Flush => "Flush",
        HandRankCategory.Straight => "Straight",
        HandRankCategory.ThreeOfAKind => "Three of a Kind",
        HandRankCategory.TwoPair => "Two Pair",
        HandRankCategory.OnePair => "One Pair",
        HandRankCategory.HighCard => "High Card",
        _ => "Unknown"
    };
}
