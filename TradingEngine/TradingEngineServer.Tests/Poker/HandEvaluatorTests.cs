using FluentAssertions;
using TradingEngineServer.Core.Poker.Models;
using TradingEngineServer.Core.Poker.Services;

namespace TradingEngineServer.Tests.Poker;

public class HandEvaluatorTests
{
    [Fact]
    public void Evaluate_GivenRoyalFlush_ReturnsRoyalFlushCategory()
    {
        var hand = new List<Card>
        {
            new(Rank.Ten, Suit.Spades),
            new(Rank.Jack, Suit.Spades),
            new(Rank.Queen, Suit.Spades),
            new(Rank.King, Suit.Spades),
            new(Rank.Ace, Suit.Spades)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.RoyalFlush);
        result.Kickers.Should().ContainSingle().Which.Should().Be((int)Rank.Ace);
    }

    [Fact]
    public void Evaluate_GivenStraightFlush_ReturnsStraightFlushCategory()
    {
        var hand = new List<Card>
        {
            new(Rank.Nine, Suit.Hearts),
            new(Rank.Ten, Suit.Hearts),
            new(Rank.Jack, Suit.Hearts),
            new(Rank.Queen, Suit.Hearts),
            new(Rank.King, Suit.Hearts)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.StraightFlush);
        result.Kickers.Should().ContainSingle().Which.Should().Be((int)Rank.King);
    }

    [Fact]
    public void Evaluate_GivenFourOfAKind_ReturnsFourOfAKindCategoryAndKicker()
    {
        var hand = new List<Card>
        {
            new(Rank.Four, Suit.Hearts),
            new(Rank.Four, Suit.Diamonds),
            new(Rank.Four, Suit.Clubs),
            new(Rank.Four, Suit.Spades),
            new(Rank.Jack, Suit.Hearts)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.FourOfAKind);
        result.Kickers.Should().HaveCount(2);
        result.Kickers[0].Should().Be((int)Rank.Four);
        result.Kickers[1].Should().Be((int)Rank.Jack);
    }

    [Fact]
    public void Evaluate_GivenFullHouse_ReturnsFullHouseCategory()
    {
        var hand = new List<Card>
        {
            new(Rank.Ten, Suit.Hearts),
            new(Rank.Ten, Suit.Diamonds),
            new(Rank.Ten, Suit.Clubs),
            new(Rank.King, Suit.Spades),
            new(Rank.King, Suit.Hearts)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.FullHouse);
        result.Kickers[0].Should().Be((int)Rank.Ten);
        result.Kickers[1].Should().Be((int)Rank.King);
    }

    [Fact]
    public void Evaluate_GivenFlush_ReturnsFlushCategoryAndSortedKickers()
    {
        var hand = new List<Card>
        {
            new(Rank.Two, Suit.Hearts),
            new(Rank.Four, Suit.Hearts),
            new(Rank.Seven, Suit.Hearts),
            new(Rank.Jack, Suit.Hearts),
            new(Rank.Ace, Suit.Hearts)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.Flush);
        result.Kickers.Should().BeEquivalentTo(new[] { 14, 11, 7, 4, 2 }, options => options.WithStrictOrdering());
    }

    [Fact]
    public void Evaluate_GivenAceLowStraight_ReturnsStraightCategoryWithFiveHigh()
    {
        var hand = new List<Card>
        {
            new(Rank.Ace, Suit.Spades),
            new(Rank.Two, Suit.Hearts),
            new(Rank.Three, Suit.Diamonds),
            new(Rank.Four, Suit.Clubs),
            new(Rank.Five, Suit.Spades)
        };

        var result = HandEvaluator.Evaluate(hand);

        result.Category.Should().Be(HandRankCategory.Straight);
        result.Kickers.Should().ContainSingle().Which.Should().Be((int)Rank.Five);
    }

    [Fact]
    public void Compare_HigherHandCategoryWins()
    {
        var flush = new HandResult(HandRankCategory.Flush, new List<int> { 13 });
        var fullHouse = new HandResult(HandRankCategory.FullHouse, new List<int> { 10, 2 });

        HandEvaluator.CompareHands(fullHouse, flush).Should().BeGreaterThan(0);
        HandEvaluator.CompareHands(flush, fullHouse).Should().BeLessThan(0);
    }

    [Fact]
    public void Compare_SameCategory_HigherKickerWins()
    {
        var pairKings = new HandResult(HandRankCategory.OnePair, new List<int> { 13, 10, 5, 2 });
        var pairAces = new HandResult(HandRankCategory.OnePair, new List<int> { 14, 4, 3, 2 });

        HandEvaluator.CompareHands(pairAces, pairKings).Should().BeGreaterThan(0);
    }

    [Fact]
    public void FindBestHand_SelectsBest5CardsFrom7()
    {
        var holeCards = new List<Card>
        {
            new(Rank.Ace, Suit.Spades),
            new(Rank.Ace, Suit.Hearts)
        };

        var communityCards = new List<Card>
        {
            new(Rank.Two, Suit.Diamonds),
            new(Rank.Three, Suit.Spades),
            new(Rank.Ten, Suit.Clubs),
            new(Rank.Ace, Suit.Diamonds),
            new(Rank.Ace, Suit.Clubs)
        };

        var bestHand = HandEvaluator.FindBestHand(holeCards, communityCards);

        bestHand.Category.Should().Be(HandRankCategory.FourOfAKind);
        bestHand.Kickers[0].Should().Be((int)Rank.Ace);
        bestHand.Kickers[1].Should().Be((int)Rank.Ten); // Should select the 10 as the kicker, not 3 or 2
    }
}
