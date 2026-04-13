using FluentAssertions;
using TradingEngineServer.Core.Poker.Models;
using TradingEngineServer.Core.Poker.Services;

namespace TradingEngineServer.Tests.Poker;

public class PokerGameEngineTests
{
    private class RiggedDeck : IDeck
    {
        private readonly Queue<Card> _cards = new();

        public RiggedDeck(IEnumerable<Card> cards)
        {
            foreach (var card in cards)
            {
                _cards.Enqueue(card);
            }
        }

        public int Remaining => _cards.Count;
        public Card Deal() => _cards.Dequeue();
        public void Shuffle() { /* Do nothing, preserve rigged order */ }
    }

    private PokerRoom CreateTestRoom(int playerCount = 2)
    {
        var room = new PokerRoom
        {
            RoomId = "TEST",
            SmallBlind = 5,
            BigBlind = 10,
            DealerIndex = 0
        };

        for (int i = 0; i < playerCount; i++)
        {
            room.Players.Add(new PokerPlayer
            {
                UserId = $"Player{i + 1}",
                SeatIndex = i,
                ChipCount = 1000
            });
        }

        return room;
    }

    [Fact]
    public void StartHand_DealsCardsAndPostsBlinds()
    {
        var room = CreateTestRoom(3); // Dealer is 0, SB is 1, BB is 2

        // Need 2 cards * 3 players = 6 cards
        var deckCards = new List<Card>
        {
            new(Rank.Two, Suit.Hearts),   // P1 card 1
            new(Rank.Three, Suit.Hearts), // P2 card 1
            new(Rank.Four, Suit.Hearts),  // P3 card 1
            new(Rank.Five, Suit.Hearts),  // P1 card 2
            new(Rank.Six, Suit.Hearts),   // P2 card 2
            new(Rank.Seven, Suit.Hearts)  // P3 card 2
        };
        var riggedDeck = new RiggedDeck(deckCards);

        PokerGameEngine.StartHand(room, riggedDeck);

        // Dealer index advances to 1
        room.DealerIndex.Should().Be(1);
        room.Phase.Should().Be(PokerPhase.PreFlop);

        // Blinds posted
        var p1 = room.Players[0];
        var p2 = room.Players[1]; // Dealer
        var p3 = room.Players[2];

        // Based on DealerIndex = 0 (before advance) -> 1
        // Dealer = P2 (index 1)
        // SB = P3 (index 2)
        // BB = P1 (index 0)
        p3.CurrentBet.Should().Be(5);
        p1.CurrentBet.Should().Be(10);
        room.CurrentBet.Should().Be(10);
        room.Pot.Should().Be(15);

        // First to act PreFlop should be after BB (P1), so P2
        room.ActivePlayerIndex.Should().Be(1);

        // Cards dealt correctly
        p1.HoleCards.Should().HaveCount(2);
        p2.HoleCards.Should().HaveCount(2);
        p3.HoleCards.Should().HaveCount(2);
    }

    [Fact]
    public void HandleAction_FoldingRemovesPlayerFromHand()
    {
        var room = CreateTestRoom(3);
        room.DealerIndex = 2; // So next dealer is 0, SB is 1, BB is 2
        var deckCards = Enumerable.Range(0, 52).Select(i => new Card(Rank.Two, Suit.Hearts)).ToList();
        var deck = new RiggedDeck(deckCards);

        PokerGameEngine.StartHand(room, deck);

        // Dealer = P1(0), SB = P2(1), BB = P3(2). UTG acts first: P1(0)
        var actingPlayer = room.ActivePlayer;
        actingPlayer.Should().NotBeNull();
        actingPlayer!.UserId.Should().Be("Player1");

        bool continued = PokerGameEngine.HandleAction(room, actingPlayer.UserId, PokerAction.Fold);

        continued.Should().BeTrue();
        actingPlayer.HasFolded.Should().BeTrue();
        room.ActivePlayers.Should().HaveCount(2);

        // Next active player should be P2(1)
        room.ActivePlayerIndex.Should().Be(1);
    }

    [Fact]
    public void HandleAction_AllFold_AwardsPotToLastStanding()
    {
        var room = CreateTestRoom(2); // P1, P2
        room.DealerIndex = 0; // P2 dealer -> SB=P2, BB=P1. P2 acts first Pre-Flop
        var deckCards = Enumerable.Range(0, 52).Select(i => new Card(Rank.Two, Suit.Hearts)).ToList();
        var deck = new RiggedDeck(deckCards);

        PokerGameEngine.StartHand(room, deck);

        var p2 = room.Players[1];

        // P2 acts first, folds
        bool continued = PokerGameEngine.HandleAction(room, p2.UserId, PokerAction.Fold);

        continued.Should().BeFalse();
        room.Phase.Should().Be(PokerPhase.Showdown);
        room.WinnerUserIds.Should().ContainSingle().Which.Should().Be("Player1");
        
        // P1 should have all the chips from the pot
        var p1 = room.Players[0];
        p1.ChipCount.Should().Be(1005); // 1000 - 10 (BB) + 15 (Pot: 5 SB + 10 BB)
    }

    [Fact]
    public void HandleAction_CallingAdvancesPhaseWhenRoundComplete()
    {
        var room = CreateTestRoom(2);
        room.DealerIndex = 0; // next=1 (P2 is Dealer/SB, P1 is BB)

        var deckCards = Enumerable.Range(0, 52).Select(i => new Card(Rank.Two, Suit.Hearts)).ToList();
        var deck = new RiggedDeck(deckCards);

        PokerGameEngine.StartHand(room, deck);

        // Preflop: SB(P2) is 5, BB(P1) is 10. P2 acts first. P2 calls 5 more.
        PokerGameEngine.HandleAction(room, "Player2", PokerAction.Call);

        // P1 checks
        bool continued = PokerGameEngine.HandleAction(room, "Player1", PokerAction.Check);

        continued.Should().BeTrue();
        room.Phase.Should().Be(PokerPhase.Flop); // PreFlop -> Flop
        room.Players[0].CurrentBet.Should().Be(0); // Bets reset
        room.CurrentBet.Should().Be(0);
        room.Pot.Should().Be(20);
    }
}
