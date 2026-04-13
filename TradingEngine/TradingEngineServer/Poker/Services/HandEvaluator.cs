namespace TradingEngineServer.Core.Poker.Services;

using TradingEngineServer.Core.Poker.Models;

/// <summary>
/// Pure-function hand evaluator. No side effects, no I/O — trivially testable.
/// Evaluates poker hands and finds the best 5-card combination from 7 cards.
/// </summary>
public static class HandEvaluator
{
    /// <summary>
    /// Evaluate exactly 5 cards and return their hand ranking with kickers.
    /// </summary>
    public static HandResult Evaluate(List<Card> cards)
    {
        if (cards.Count != 5)
            throw new ArgumentException("Hand evaluation requires exactly 5 cards.");

        var sorted = cards.OrderByDescending(c => (int)c.Rank).ToList();
        var ranks = sorted.Select(c => (int)c.Rank).ToList();
        var suits = sorted.Select(c => c.Suit).ToList();

        bool isFlush = suits.Distinct().Count() == 1;
        bool isStraight = IsStraight(ranks, out int straightHigh);

        // Group by rank for pair/trip/quad detection
        var groups = ranks.GroupBy(r => r)
                          .OrderByDescending(g => g.Count())
                          .ThenByDescending(g => g.Key)
                          .ToList();

        int[] counts = groups.Select(g => g.Count()).ToArray();

        // Royal Flush
        if (isFlush && isStraight && straightHigh == (int)Rank.Ace)
            return new HandResult(HandRankCategory.RoyalFlush, new List<int> { straightHigh });

        // Straight Flush
        if (isFlush && isStraight)
            return new HandResult(HandRankCategory.StraightFlush, new List<int> { straightHigh });

        // Four of a Kind
        if (counts.Length >= 1 && counts[0] == 4)
        {
            int quadRank = groups[0].Key;
            int kicker = groups[1].Key;
            return new HandResult(HandRankCategory.FourOfAKind, new List<int> { quadRank, kicker });
        }

        // Full House
        if (counts.Length >= 2 && counts[0] == 3 && counts[1] == 2)
        {
            return new HandResult(HandRankCategory.FullHouse, new List<int> { groups[0].Key, groups[1].Key });
        }

        // Flush
        if (isFlush)
            return new HandResult(HandRankCategory.Flush, ranks);

        // Straight
        if (isStraight)
            return new HandResult(HandRankCategory.Straight, new List<int> { straightHigh });

        // Three of a Kind
        if (counts.Length >= 1 && counts[0] == 3)
        {
            var kickers = groups.Skip(1).Select(g => g.Key).ToList();
            return new HandResult(HandRankCategory.ThreeOfAKind,
                new List<int> { groups[0].Key }.Concat(kickers).ToList());
        }

        // Two Pair
        if (counts.Length >= 2 && counts[0] == 2 && counts[1] == 2)
        {
            int highPair = Math.Max(groups[0].Key, groups[1].Key);
            int lowPair = Math.Min(groups[0].Key, groups[1].Key);
            int kicker = groups[2].Key;
            return new HandResult(HandRankCategory.TwoPair, new List<int> { highPair, lowPair, kicker });
        }

        // One Pair
        if (counts.Length >= 1 && counts[0] == 2)
        {
            var kickers = groups.Skip(1).Select(g => g.Key).ToList();
            return new HandResult(HandRankCategory.OnePair,
                new List<int> { groups[0].Key }.Concat(kickers).ToList());
        }

        // High Card
        return new HandResult(HandRankCategory.HighCard, ranks);
    }

    /// <summary>
    /// Find the best 5-card hand from 7 cards (2 hole + 5 community).
    /// Tries all C(7,5) = 21 combinations.
    /// </summary>
    public static HandResult FindBestHand(List<Card> holeCards, List<Card> communityCards)
    {
        var allCards = holeCards.Concat(communityCards).ToList();
        if (allCards.Count < 5)
            throw new ArgumentException("Need at least 5 total cards to evaluate.");

        HandResult? best = null;

        var combos = GetCombinations(allCards, 5);
        foreach (var combo in combos)
        {
            var result = Evaluate(combo);
            if (best is null || result.CompareTo(best) > 0)
                best = result;
        }

        return best!;
    }

    /// <summary>
    /// Compare two hand results. Returns positive if a wins, negative if b wins, 0 for tie.
    /// </summary>
    public static int CompareHands(HandResult a, HandResult b) => a.CompareTo(b);

    private static bool IsStraight(List<int> sortedRanks, out int highCard)
    {
        highCard = sortedRanks[0];

        // Normal straight check
        if (sortedRanks[0] - sortedRanks[4] == 4 && sortedRanks.Distinct().Count() == 5)
            return true;

        // Ace-low straight (A-2-3-4-5): ranks would be [14, 5, 4, 3, 2]
        if (sortedRanks.SequenceEqual(new[] { 14, 5, 4, 3, 2 }))
        {
            highCard = 5; // Five-high straight
            return true;
        }

        return false;
    }

    private static IEnumerable<List<Card>> GetCombinations(List<Card> cards, int k)
    {
        if (k == 0)
        {
            yield return new List<Card>();
            yield break;
        }

        for (int i = 0; i <= cards.Count - k; i++)
        {
            foreach (var combo in GetCombinations(cards.Skip(i + 1).ToList(), k - 1))
            {
                combo.Insert(0, cards[i]);
                yield return combo;
            }
        }
    }
}
