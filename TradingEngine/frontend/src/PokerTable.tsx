import { useState } from 'react';

interface CardData {
    rank: string;
    suit: string;
    display: string;
    color: string;
}

interface PlayerData {
    userId: string;
    seatIndex: number;
    chipCount: number;
    currentBet: number;
    hasFolded: boolean;
    isAllIn: boolean;
    hasActed: boolean;
    holeCards: CardData[];
    handDescription: string;
}

interface PokerRoomState {
    roomId: string;
    hostUserId: string;
    players: PlayerData[];
    communityCards: CardData[];
    phase: string;
    pot: number;
    currentBet: number;
    smallBlind: number;
    bigBlind: number;
    dealerIndex: number;
    activePlayerIndex: number;
    activePlayerUserId: string;
    winnerUserIds: string[];
    winningHandDescription: string;
    handLog: string[];
    forPlayer: string;
}

interface PokerTableProps {
    room: PokerRoomState;
    loggedInUser: string;
    isHost: boolean;
    apiBase: string;
    onLeave: () => void;
}

// Seat positions around an oval table (percentages)
const SEAT_POSITIONS = [
    { top: '78%', left: '50%' },   // 0 - bottom center (you)
    { top: '70%', left: '15%' },   // 1 - bottom left
    { top: '35%', left: '3%' },    // 2 - middle left
    { top: '5%',  left: '18%' },   // 3 - top left
    { top: '5%',  left: '50%' },   // 4 - top center
    { top: '5%',  left: '82%' },   // 5 - top right
    { top: '35%', left: '97%' },   // 6 - middle right
    { top: '70%', left: '85%' },   // 7 - bottom right
];

function PokerCard({ card, faceDown = false }: { card?: CardData; faceDown?: boolean }) {
    if (!card || faceDown) {
        return (
            <div className="poker-card poker-card-back">
                <span>🂠</span>
            </div>
        );
    }

    return (
        <div className={`poker-card ${card.color === 'red' ? 'poker-card-red' : 'poker-card-black'}`}>
            <span className="poker-card-rank">{card.rank}</span>
            <span className="poker-card-suit">{card.suit}</span>
        </div>
    );
}

function PlayerSeat({ player, isMe, isDealer, isActive, isWinner, showCards, phase }: {
    player: PlayerData;
    isMe: boolean;
    isDealer: boolean;
    isActive: boolean;
    isWinner: boolean;
    showCards: boolean;
    phase: string;
}) {
    const hasCards = player.holeCards && player.holeCards.length > 0;
    const isShowdown = phase === 'Showdown';

    return (
        <div className={`poker-seat ${isActive ? 'poker-seat-active' : ''} ${player.hasFolded ? 'poker-seat-folded' : ''} ${isWinner ? 'poker-seat-winner' : ''}`}>
            {/* Player cards */}
            {hasCards && !player.hasFolded && (
                <div className="poker-seat-cards">
                    {showCards ? (
                        player.holeCards.map((card, i) => <PokerCard key={i} card={card} />)
                    ) : (
                        <>
                            <PokerCard faceDown />
                            <PokerCard faceDown />
                        </>
                    )}
                </div>
            )}

            {/* Player info chip */}
            <div className={`poker-seat-info ${isMe ? 'poker-seat-me' : ''}`}>
                {isDealer && <span className="poker-dealer-btn">D</span>}
                <span className="poker-seat-name">{player.userId}</span>
                <span className="poker-seat-chips">${player.chipCount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                {player.isAllIn && <span className="poker-allin-badge">ALL IN</span>}
                {player.hasFolded && <span className="poker-fold-badge">FOLD</span>}
            </div>

            {/* Current bet */}
            {player.currentBet > 0 && (
                <div className="poker-seat-bet">
                    <span className="poker-bet-chip">🪙</span> ${player.currentBet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            )}

            {/* Hand description at showdown */}
            {isShowdown && player.handDescription && !player.hasFolded && (
                <div className="poker-hand-desc">{player.handDescription}</div>
            )}
        </div>
    );
}

export default function PokerTable({ room, loggedInUser, isHost, apiBase, onLeave }: PokerTableProps) {
    const [raiseAmount, setRaiseAmount] = useState<number>(room.bigBlind);
    const [actionLoading, setActionLoading] = useState(false);

    const isMyTurn = room.activePlayerUserId === loggedInUser;
    const myPlayer = room.players.find(p => p.userId === loggedInUser);
    const callAmount = myPlayer ? room.currentBet - myPlayer.currentBet : 0;
    const canCheck = callAmount === 0;

    const sendAction = async (action: string, amount?: number) => {
        setActionLoading(true);
        try {
            await fetch(`${apiBase}/api/poker/rooms/${room.roomId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser, action, amount: amount || 0 })
            });
        } catch (err) {
            console.error('Action failed:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const startHand = async () => {
        await fetch(`${apiBase}/api/poker/rooms/${room.roomId}/start`, { method: 'POST' });
    };

    // Reorder players so "me" is at seat index 0 (bottom center)
    const reorderedPlayers = (() => {
        const myIdx = room.players.findIndex(p => p.userId === loggedInUser);
        if (myIdx <= 0) return room.players;
        return [...room.players.slice(myIdx), ...room.players.slice(0, myIdx)];
    })();

    return (
        <div className="poker-container">
            {/* Header */}
            <div className="poker-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onLeave} className="poker-back-btn">← Leave</button>
                    <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>
                        Room <span style={{ color: '#10b981' }}>#{room.roomId}</span>
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Blinds: ${room.smallBlind}/${room.bigBlind}
                    </span>
                    <span className={`poker-phase-badge poker-phase-${room.phase.toLowerCase()}`}>
                        {room.phase}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="poker-table-wrapper">
                <div className="poker-table-felt">
                    {/* Community Cards */}
                    <div className="poker-community">
                        {room.communityCards.length > 0 ? (
                            room.communityCards.map((card, i) => (
                                <PokerCard key={i} card={card} />
                            ))
                        ) : (
                            room.phase !== 'Waiting' && room.phase !== 'Showdown' && room.phase !== 'PreFlop' ? (
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>Dealing...</span>
                            ) : null
                        )}
                    </div>

                    {/* Pot */}
                    {room.pot > 0 && (
                        <div className="poker-pot">
                            🏆 Pot: ${room.pot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    )}

                    {/* Winner announcement */}
                    {room.phase === 'Showdown' && room.winnerUserIds.length > 0 && (
                        <div className="poker-winner-banner">
                            🎉 {room.winnerUserIds.join(', ')} wins with {room.winningHandDescription}!
                        </div>
                    )}

                    {/* Player Seats */}
                    {reorderedPlayers.map((player, visualIdx) => {
                        const originalIdx = room.players.findIndex(p => p.userId === player.userId);
                        const pos = SEAT_POSITIONS[visualIdx] || SEAT_POSITIONS[0];
                        return (
                            <div
                                key={player.userId}
                                className="poker-seat-container"
                                style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
                            >
                                <PlayerSeat
                                    player={player}
                                    isMe={player.userId === loggedInUser}
                                    isDealer={originalIdx === room.dealerIndex}
                                    isActive={player.userId === room.activePlayerUserId}
                                    isWinner={room.winnerUserIds.includes(player.userId)}
                                    showCards={player.userId === loggedInUser || (room.phase === 'Showdown' && !player.hasFolded && player.holeCards.length > 0)}
                                    phase={room.phase}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Bar */}
            <div className="poker-actions">
                {room.phase === 'Waiting' && (
                    <div className="poker-waiting-actions">
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                            {room.players.length} player{room.players.length !== 1 ? 's' : ''} at the table
                        </p>
                        {isHost && room.players.length >= 2 && (
                            <button onClick={startHand} className="btn poker-btn-deal">
                                🃏 Deal Cards
                            </button>
                        )}
                        {isHost && room.players.length < 2 && (
                            <p style={{ color: '#f59e0b' }}>Need at least 2 players to start</p>
                        )}
                        {!isHost && <p style={{ color: 'var(--text-secondary)' }}>Waiting for host to deal...</p>}
                    </div>
                )}

                {room.phase === 'Showdown' && (
                    <div className="poker-waiting-actions">
                        {isHost && (
                            <button onClick={startHand} className="btn poker-btn-deal">
                                🃏 Next Hand
                            </button>
                        )}
                    </div>
                )}

                {isMyTurn && room.phase !== 'Waiting' && room.phase !== 'Showdown' && (
                    <div className="poker-turn-actions">
                        <span className="poker-turn-indicator">⚡ Your Turn</span>

                        <button
                            className="btn poker-btn-fold"
                            onClick={() => sendAction('Fold')}
                            disabled={actionLoading}
                        >
                            Fold
                        </button>

                        {canCheck ? (
                            <button
                                className="btn poker-btn-check"
                                onClick={() => sendAction('Check')}
                                disabled={actionLoading}
                            >
                                Check
                            </button>
                        ) : (
                            <button
                                className="btn poker-btn-call"
                                onClick={() => sendAction('Call')}
                                disabled={actionLoading}
                            >
                                Call ${callAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </button>
                        )}

                        <div className="poker-raise-group">
                            <input
                                type="range"
                                min={room.bigBlind}
                                max={myPlayer?.chipCount || 100}
                                step={room.bigBlind}
                                value={raiseAmount}
                                onChange={e => setRaiseAmount(Number(e.target.value))}
                                className="poker-raise-slider"
                            />
                            <button
                                className="btn poker-btn-raise"
                                onClick={() => sendAction('Raise', raiseAmount)}
                                disabled={actionLoading}
                            >
                                Raise ${raiseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </button>
                        </div>
                    </div>
                )}

                {!isMyTurn && room.phase !== 'Waiting' && room.phase !== 'Showdown' && (
                    <div className="poker-waiting-actions">
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Waiting for <strong style={{ color: 'white' }}>{room.activePlayerUserId}</strong> to act...
                        </p>
                    </div>
                )}
            </div>

            {/* Hand Log */}
            {room.handLog.length > 0 && (
                <div className="poker-log">
                    {room.handLog.map((entry, i) => (
                        <div key={i} className="poker-log-entry">{entry}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
