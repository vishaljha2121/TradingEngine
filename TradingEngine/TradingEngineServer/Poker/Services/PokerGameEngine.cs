namespace TradingEngineServer.Core.Poker.Services;

using TradingEngineServer.Core.Poker.Models;

/// <summary>
/// State machine that manages the flow of a Texas Hold'em hand.
/// Pure game logic — no I/O, no SignalR, no Redis. Receives room state and mutates it.
/// The infrastructure layer is responsible for broadcasting changes.
/// </summary>
public static class PokerGameEngine
{
    // ──────────────────────────────────────────────
    // 1. STARTING A HAND
    // ──────────────────────────────────────────────

    /// <summary>
    /// Shuffle deck, deal hole cards, post blinds, set phase to PreFlop.
    /// </summary>
    public static void StartHand(PokerRoom room, IDeck deck)
    {
        if (room.Players.Count < 2)
            throw new InvalidOperationException("Need at least 2 players to start a hand.");

        room.ResetForNewHand();
        deck.Shuffle();

        // Advance dealer button
        room.DealerIndex = (room.DealerIndex + 1) % room.Players.Count;

        // Deal 2 hole cards to each player
        for (int round = 0; round < 2; round++)
        {
            foreach (var player in room.Players)
            {
                player.HoleCards.Add(deck.Deal());
            }
        }

        // Post blinds
        int smallBlindIndex = GetSmallBlindIndex(room);
        int bigBlindIndex = GetBigBlindIndex(room);

        PostBlind(room, room.Players[smallBlindIndex], room.SmallBlind, "small blind");
        PostBlind(room, room.Players[bigBlindIndex], room.BigBlind, "big blind");

        room.CurrentBet = room.BigBlind;
        room.Phase = PokerPhase.PreFlop;

        // First to act pre-flop is the player after the big blind
        room.ActivePlayerIndex = FindNextActivePlayer(room, bigBlindIndex);

        room.HandLog.Add($"--- New Hand --- Dealer: {room.Players[room.DealerIndex].UserId}");
    }

    // ──────────────────────────────────────────────
    // 2. HANDLING PLAYER ACTIONS
    // ──────────────────────────────────────────────

    /// <summary>
    /// Process a player action. Returns true if the hand continues, false if it's over.
    /// </summary>
    public static bool HandleAction(PokerRoom room, string userId, PokerAction action, double raiseAmount = 0)
    {
        var player = room.Players.FirstOrDefault(p => p.UserId == userId);
        if (player is null)
            throw new InvalidOperationException($"Player {userId} not found in room.");

        if (room.ActivePlayer?.UserId != userId)
            throw new InvalidOperationException($"It's not {userId}'s turn.");

        if (player.HasFolded)
            throw new InvalidOperationException($"{userId} has already folded.");

        switch (action)
        {
            case PokerAction.Fold:
                player.HasFolded = true;
                player.HasActed = true;
                room.HandLog.Add($"{userId} folds.");
                break;

            case PokerAction.Check:
                if (room.CurrentBet > player.CurrentBet)
                    throw new InvalidOperationException("Cannot check — there's an outstanding bet.");
                player.HasActed = true;
                room.HandLog.Add($"{userId} checks.");
                break;

            case PokerAction.Call:
                double callAmount = Math.Min(room.CurrentBet - player.CurrentBet, player.ChipCount);
                PlaceBet(room, player, callAmount);
                player.HasActed = true;
                room.HandLog.Add($"{userId} calls ${callAmount:F0}.");
                break;

            case PokerAction.Raise:
                double totalRaise = raiseAmount;
                if (totalRaise < room.BigBlind)
                    totalRaise = room.BigBlind;

                double raiseToAmount = room.CurrentBet + totalRaise;
                double amountToAdd = Math.Min(raiseToAmount - player.CurrentBet, player.ChipCount);
                PlaceBet(room, player, amountToAdd);
                room.CurrentBet = player.CurrentBet;
                player.HasActed = true;

                // Reset HasActed for other active players (they must respond to the raise)
                foreach (var p in room.Players.Where(p => p != player && p.IsActiveInHand && !p.IsAllIn))
                {
                    p.HasActed = false;
                }

                room.HandLog.Add($"{userId} raises to ${room.CurrentBet:F0}.");
                break;
        }

        // Check if only one player remains
        if (room.ActivePlayers.Count == 1)
        {
            AwardPotToLastPlayer(room);
            return false;
        }

        // Check if betting round is complete
        if (IsBettingRoundComplete(room))
        {
            return AdvanceToNextPhase(room);
        }

        // Move to next player
        room.ActivePlayerIndex = FindNextActivePlayer(room, room.ActivePlayerIndex);
        return true;
    }

    // ──────────────────────────────────────────────
    // 3. PHASE ADVANCEMENT
    // ──────────────────────────────────────────────

    /// <summary>
    /// Deal community cards and advance to the next phase. Returns true if hand continues.
    /// </summary>
    public static bool AdvanceToNextPhase(PokerRoom room)
    {
        // Collect bets into pot
        foreach (var p in room.Players)
        {
            p.ResetForNewBettingRound();
        }
        room.CurrentBet = 0;

        switch (room.Phase)
        {
            case PokerPhase.PreFlop:
                room.Phase = PokerPhase.Flop;
                room.HandLog.Add("--- Flop ---");
                break;

            case PokerPhase.Flop:
                room.Phase = PokerPhase.Turn;
                room.HandLog.Add("--- Turn ---");
                break;

            case PokerPhase.Turn:
                room.Phase = PokerPhase.River;
                room.HandLog.Add("--- River ---");
                break;

            case PokerPhase.River:
                // Go to showdown
                ResolveShowdown(room);
                return false;
        }

        // First to act post-flop is the player after dealer
        room.ActivePlayerIndex = FindNextActivePlayer(room, room.DealerIndex);

        // If all remaining players are all-in, skip betting
        if (room.ActivePlayers.All(p => p.IsAllIn))
        {
            return AdvanceToNextPhase(room);
        }

        return true;
    }

    /// <summary>
    /// Deal community cards for the given phase using the provided deck.
    /// Called by the endpoint layer after StartHand sets up the deck.
    /// </summary>
    public static void DealCommunityCards(PokerRoom room, IDeck deck)
    {
        switch (room.Phase)
        {
            case PokerPhase.Flop:
                for (int i = 0; i < 3; i++)
                    room.CommunityCards.Add(deck.Deal());
                break;

            case PokerPhase.Turn:
            case PokerPhase.River:
                room.CommunityCards.Add(deck.Deal());
                break;
        }
    }

    // ──────────────────────────────────────────────
    // 4. SHOWDOWN
    // ──────────────────────────────────────────────

    /// <summary>
    /// Evaluate all remaining hands and award the pot.
    /// </summary>
    public static void ResolveShowdown(PokerRoom room)
    {
        room.Phase = PokerPhase.Showdown;

        var activePlayers = room.ActivePlayers;
        if (activePlayers.Count == 0) return;

        if (activePlayers.Count == 1)
        {
            AwardPotToLastPlayer(room);
            return;
        }

        // Evaluate each active player's hand
        var playerHands = new List<(PokerPlayer Player, HandResult Hand)>();
        foreach (var player in activePlayers)
        {
            var hand = HandEvaluator.FindBestHand(player.HoleCards, room.CommunityCards);
            playerHands.Add((player, hand));
            room.PlayerHandDescriptions[player.UserId] = hand.Description;
        }

        // Find the best hand
        var bestHand = playerHands.MaxBy(ph => ph.Hand)!;

        // Find all players who tied for the best hand
        var winners = playerHands
            .Where(ph => ph.Hand.CompareTo(bestHand.Hand) == 0)
            .Select(ph => ph.Player)
            .ToList();

        // Split the pot among winners
        double share = room.Pot / winners.Count;
        foreach (var winner in winners)
        {
            winner.ChipCount += share;
            room.WinnerUserIds.Add(winner.UserId);
        }

        room.WinningHandDescription = bestHand.Hand.Description;
        room.HandLog.Add($"--- Showdown --- Winner(s): {string.Join(", ", room.WinnerUserIds)} with {room.WinningHandDescription}");
        room.Pot = 0;
    }

    // ──────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────

    private static void PostBlind(PokerRoom room, PokerPlayer player, double amount, string label)
    {
        double actual = Math.Min(amount, player.ChipCount);
        PlaceBet(room, player, actual);
        room.HandLog.Add($"{player.UserId} posts {label} ${actual:F0}.");
    }

    private static void PlaceBet(PokerRoom room, PokerPlayer player, double amount)
    {
        double actual = Math.Min(amount, player.ChipCount);
        player.ChipCount -= actual;
        player.CurrentBet += actual;
        player.TotalBetThisHand += actual;
        room.Pot += actual;

        if (player.ChipCount <= 0)
        {
            player.IsAllIn = true;
        }
    }

    private static int GetSmallBlindIndex(PokerRoom room)
    {
        if (room.Players.Count == 2)
            return room.DealerIndex; // Heads-up: dealer is small blind

        return (room.DealerIndex + 1) % room.Players.Count;
    }

    private static int GetBigBlindIndex(PokerRoom room)
    {
        if (room.Players.Count == 2)
            return (room.DealerIndex + 1) % room.Players.Count;

        return (room.DealerIndex + 2) % room.Players.Count;
    }

    private static int FindNextActivePlayer(PokerRoom room, int fromIndex)
    {
        int count = room.Players.Count;
        for (int i = 1; i <= count; i++)
        {
            int idx = (fromIndex + i) % count;
            var player = room.Players[idx];
            if (player.IsActiveInHand && !player.IsAllIn && !player.HasActed)
                return idx;
        }

        // Everyone has acted or only all-in players remain
        return -1;
    }

    private static bool IsBettingRoundComplete(PokerRoom room)
    {
        return room.ActivePlayers
            .Where(p => !p.IsAllIn)
            .All(p => p.HasActed && p.CurrentBet == room.CurrentBet);
    }

    private static void AwardPotToLastPlayer(PokerRoom room)
    {
        var winner = room.ActivePlayers.First();
        winner.ChipCount += room.Pot;
        room.WinnerUserIds.Add(winner.UserId);
        room.WinningHandDescription = "Last player standing";
        room.HandLog.Add($"{winner.UserId} wins ${room.Pot:F0} (everyone else folded).");
        room.Pot = 0;
        room.Phase = PokerPhase.Showdown;
    }
}
