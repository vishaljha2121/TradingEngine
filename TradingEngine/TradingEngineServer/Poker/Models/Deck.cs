namespace TradingEngineServer.Core.Poker.Models;

/// <summary>
/// Abstraction for a deck of cards. Enables deterministic testing via mock implementations.
/// </summary>
public interface IDeck
{
    void Shuffle();
    Card Deal();
    int Remaining { get; }
}

/// <summary>
/// Standard 52-card deck with Fisher-Yates shuffle.
/// </summary>
public class StandardDeck : IDeck
{
    private readonly List<Card> _cards;
    private int _dealIndex;

    public StandardDeck()
    {
        _cards = new List<Card>(52);
        foreach (Suit suit in Enum.GetValues<Suit>())
        {
            foreach (Rank rank in Enum.GetValues<Rank>())
            {
                _cards.Add(new Card(rank, suit));
            }
        }
        _dealIndex = 0;
    }

    public int Remaining => _cards.Count - _dealIndex;

    public void Shuffle()
    {
        _dealIndex = 0;
        var rng = Random.Shared;

        // Fisher-Yates shuffle — O(n), unbiased
        for (int i = _cards.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (_cards[i], _cards[j]) = (_cards[j], _cards[i]);
        }
    }

    public Card Deal()
    {
        if (_dealIndex >= _cards.Count)
            throw new InvalidOperationException("No cards remaining in deck.");

        return _cards[_dealIndex++];
    }
}
