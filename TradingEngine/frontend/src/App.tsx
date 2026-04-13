import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PokerTable from './PokerTable';

interface Order {
    isBuy: boolean;
    price: number;
    size: number;
}

interface PriceLevel {
    price: number;
    size: number;
}

interface OrderBookSnapshot {
    symbol: string;
    bids: PriceLevel[];
    asks: PriceLevel[];
}

interface Trade {
    id: string;
    symbol: string;
    price: number;
    size: number;
    timestamp: string;
    makerUserId: string;
    takerUserId: string;
}

interface Metrics {
    latencyUs: number;
    allocations: number;
    coreId: number;
}

const API_BASE = "http://" + window.location.hostname + ":12000";

function App() {
    const [connected, setConnected] = useState(false);
    const [orderBook, setOrderBook] = useState<OrderBookSnapshot>({ symbol: '', bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ latencyUs: 0, allocations: 0, coreId: -1 });

    const [userId, setUserId] = useState<string>('');
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
    const [balances, setBalances] = useState<{ USD: number; BTC: number }>({ USD: 0, BTC: 0 });

    const [currentScreen, setCurrentScreen] = useState<'login' | 'selection' | 'exchange' | 'lobby' | 'room' | 'poker-lobby' | 'poker-table'>('login');

    // Multiplayer Game Room State
    const [lobbyCodeInput, setLobbyCodeInput] = useState('');
    const [activeRoom, setActiveRoom] = useState<any>(null);
    const [isHost, setIsHost] = useState(false);

    // Poker State
    const [pokerRoom, setPokerRoom] = useState<any>(null);
    const [pokerLobbyCode, setPokerLobbyCode] = useState('');

    const [gamePrediction, setGamePrediction] = useState<string | null>(null);
    const gamePredictionRef = useRef<string | null>(null);
    const lastTradePriceRef = useRef<number>(0);

    const [isAdminLogin, setIsAdminLogin] = useState<boolean>(false);
    const [adminPassword, setAdminPassword] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [adminUsersInfo, setAdminUsersInfo] = useState<{ [key: string]: { USD: number, BTC: number } }>({});

    const loggedInUserRef = useRef<string | null>(null);
    useEffect(() => {
        loggedInUserRef.current = loggedInUser;
    }, [loggedInUser]);

    const [isPlaygroundOpen, setIsPlaygroundOpen] = useState<boolean>(false);

    const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderPrice, setOrderPrice] = useState<string>('50000');
    const [orderSize, setOrderSize] = useState<string>('1');
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isRunningAi, setIsRunningAi] = useState(false);

    // Mock Market Data for TrueMarkets Watchlist Cards
    const [marketPrices, setMarketPrices] = useState({
        BTC: { current: 69288.57, high: 71000, low: 68000, change: -0.2 },
        ETH: { current: 3740.17, high: 3800, low: 3600, change: -0.4 },
        SOL: { current: 154.82, high: 156, low: 140, change: +1.2 },
    });

    // Strategy Panel State
    const [playgroundSymbol, setPlaygroundSymbol] = useState<string>('btcusd');
    const [strategyType, setStrategyType] = useState<string>('sma_crossover');
    const [timeframe, setTimeframe] = useState<string>('1hr');
    const [aggression, setAggression] = useState<string>('1.0');
    const [buyThreshold, setBuyThreshold] = useState<string>('0.0001');
    const [sellThreshold, setSellThreshold] = useState<string>('0.0001');
    const [chartData, setChartData] = useState<any[]>([]);
    const [strategyMetrics, setStrategyMetrics] = useState<any>(null);

    const STRATEGY_INFO: Record<string, { name: string; description: string; icon: string }> = {
        sma_crossover: { name: 'SMA Crossover', icon: '📈', description: 'Trades when short-period (10) moving average crosses above/below long-period (30) moving average. Golden cross = buy, Death cross = sell.' },
        rsi_mean_reversion: { name: 'RSI Mean Reversion', icon: '🔄', description: 'Uses 14-period RSI to find oversold (<30) and overbought (>70) conditions. Buys dips, sells rallies.' },
        bollinger_breakout: { name: 'Bollinger Bands', icon: '📊', description: 'Trades at 2 standard deviations from 20-period SMA. Buys at lower band touch, sells at upper band touch.' },
        macd_signal: { name: 'MACD Signal', icon: '⚡', description: 'Uses 12/26 EMA crossover with 9-period signal line. Buys on bullish MACD cross, sells on bearish.' },
        momentum: { name: 'Momentum / Trend', icon: '🚀', description: 'Orderbook-based momentum strategy using price thresholds and aggression multiplier.' },
        spread_arbitrage: { name: 'Spread Arbitrage', icon: '💹', description: 'Captures the bid-ask spread on the orderbook. Works best in high-liquidity environments.' },
    };

    const isCandleStrategy = ['sma_crossover', 'rsi_mean_reversion', 'bollinger_breakout', 'macd_signal'].includes(strategyType);

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/marketdata/${playgroundSymbol}`);
                const data = await res.json();

                // Gemini returns {"bids": [{"price": "x", "amount": "y"}], "asks": ...}
                const mapLevels = (levels: any[]) => levels.map(l => ({
                    price: parseFloat(l.price),
                    size: parseFloat(l.amount)
                }));

                setOrderBook({
                    symbol: playgroundSymbol.toUpperCase(),
                    bids: mapLevels(data.bids || []),
                    asks: mapLevels(data.asks || [])
                });
            } catch (err) {
                console.error("Failed to fetch orderbook snapshot");
            }
        };

        fetchMarketData();
    }, [playgroundSymbol]);

    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_BASE}/tradinghub`)
            .withAutomaticReconnect()
            .build();

        connection.on("OrderBookUpdated", (snapshot: OrderBookSnapshot) => {
            setOrderBook(snapshot);
        });

        connection.on("ReceiveTrade", async (trade: Trade) => {
            setTrades(prev => [trade, ...prev].slice(0, 50)); // Keep last 50 trades
            lastTradePriceRef.current = trade.price;

            // Live update balance if user is involved in the trade
            if (loggedInUserRef.current && (trade.makerUserId === loggedInUserRef.current || trade.takerUserId === loggedInUserRef.current)) {
                try {
                    const res = await fetch(`${API_BASE}/api/users/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: loggedInUserRef.current })
                    });
                    const data = await res.json();
                    setBalances({ USD: data.balances.USD || 0, BTC: data.balances.BTC || 0 });
                } catch (err) {
                    console.error("Failed to update balance on trade", err);
                }
            }
        });

        connection.on("ReceiveMetrics", (m: Metrics) => {
            setMetrics(m);
        });

        // --- NEW MULTIPLAYER REAL-TIME SYNC ---
        connection.on("RoomStateUpdated", (roomData: any) => {
            setActiveRoom(roomData);
            if (roomData.state === 'WAITING' || roomData.state === 'RESOLVED') {
                setGamePrediction(null);
                gamePredictionRef.current = null;
            }
        });

        connection.on("GameResolved", (result: { roomId: string, winningOption: string }) => {
            // Animate or notify logic here if needed. 
        });

        // --- POKER REAL-TIME SYNC ---
        connection.on("PokerStateUpdated", (roomData: any) => {
            // Only update if this state is for our logged-in user
            if (roomData.forPlayer === loggedInUserRef.current) {
                setPokerRoom(roomData);
            }
        });

        connection.start()
            .then(() => setConnected(true))
            .catch(err => console.error("SignalR Connection Error: ", err));

        connection.onreconnecting(() => setConnected(false));
        connection.onreconnected(() => setConnected(true));
        connection.onclose(() => setConnected(false));

        return () => {
            connection.stop();
        };
    }, []);

    const submitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderPrice || !orderSize || !loggedInUser) {
            alert("Please log in first!");
            return;
        }

        try {
            await fetch(`${API_BASE}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: loggedInUser,
                    symbol: playgroundSymbol,
                    isBuy: orderSide === 'BUY',
                    price: parseFloat(orderPrice),
                    size: parseInt(orderSize),
                }),
            });
            // Optimistic balance update for simulation
            // (Real exchange would await order fill event from SignalR)
        } catch (err) {
            console.error("Failed to submit order", err);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isAdminLogin) {
            if (adminPassword === 'supersecret123') {
                setIsAdmin(true);
                setLoggedInUser('ADMIN');
                fetchAdminData('supersecret123');
            } else {
                alert("Invalid Admin Password");
            }
        } else {
            if (!userId) return;
            try {
                const res = await fetch(`${API_BASE}/api/users/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const data = await res.json();
                setLoggedInUser(data.userId);
                setBalances({ USD: data.balances.USD || 0, BTC: data.balances.BTC || 0 });
                setCurrentScreen('selection');
            } catch (err) {
                console.error("Failed to login", err);
                alert("Failed to connect to backend Redis service. Is the server running?");
            }
        }
    };

    const fetchAdminData = async (password: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/users`, {
                headers: { 'Admin-Password': password }
            });
            if (res.ok) {
                const data = await res.json();
                setAdminUsersInfo(data || {});
            }
        } catch (err) {
            console.error("Failed to fetch admin users data", err);
        }
    };

    const handleDeleteUser = async (userToDelete: string) => {
        if (!window.confirm(`Are you sure you want to completely delete the wallet for ${userToDelete}?`)) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userToDelete}`, {
                method: 'DELETE',
                headers: { 'Admin-Password': adminPassword }
            });
            if (res.ok) {
                fetchAdminData(adminPassword);
            }
        } catch (err) {
            console.error("Failed to delete user", err);
        }
    };

    const runAiPipeline = async () => {
        setIsRunningAi(true);
        setAiReport(null);
        try {
            const res = await fetch(`${API_BASE}/api/run-backtest`, {
                method: 'POST'
            });
            const data = await res.json();
            setAiReport(data.result || data.error);
        } catch (err) {
            console.error("Failed to run AI pipeline", err);
            setAiReport("Failed to connect to backend runner.");
        } finally {
            setIsRunningAi(false);
        }
    };

    const runCustomStrategy = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRunningAi(true);
        setAiReport(null);
        setChartData([]);
        setStrategyMetrics(null);

        try {
            const res = await fetch(`${API_BASE}/api/run-custom-strategy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: playgroundSymbol,
                    strategyType: strategyType,
                    timeframe: timeframe,
                    aggression: parseFloat(aggression),
                    buyThreshold: parseFloat(buyThreshold),
                    sellThreshold: parseFloat(sellThreshold)
                })
            });

            if (!res.ok) {
                const errData = await res.text();
                console.error('Backtest failed:', errData);
                setAiReport('Backtest failed: ' + errData);
                return;
            }

            const data = await res.json();

            setStrategyMetrics({
                total_orders: data.total_orders || 0,
                avg_latency_us: data.avg_latency_us || 0,
                max_latency_us: data.max_latency_us || 0,
                simulated_pnl: data.simulated_pnl || 0,
                win_rate: data.win_rate || 0,
                max_drawdown: data.max_drawdown || 0,
                sharpe_ratio: data.sharpe_ratio || 0
            });

            if (data.pnl_history) {
                setChartData(data.pnl_history.map((pnl: number, index: number) => ({
                    trade: index * 10,
                    pnl: pnl
                })));
            }
        } catch (err) {
            console.error("Failed to run custom strategy", err);
        } finally {
            setIsRunningAi(false);
        }
    };

    const getAiFeedback = async () => {
        setIsRunningAi(true);
        try {
            const res = await fetch(`${API_BASE}/api/ai-feedback`, { method: 'POST' });
            const data = await res.json();
            setAiReport(data.result || data.error);
        } catch (err) {
            console.error("Failed to fetch AI feedback", err);
        } finally {
            setIsRunningAi(false);
        }
    };

    // Calculate max size for depth bars
    const maxBidSize = Math.max(...orderBook.bids.map(b => b.size), 1);
    const maxAskSize = Math.max(...orderBook.asks.map(a => a.size), 1);
    const maxDepthSize = Math.max(maxBidSize, maxAskSize);

    if (!loggedInUser) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', textAlign: 'center' }}>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
                        <button onClick={() => setIsAdminLogin(false)} style={{ background: 'none', border: 'none', color: !isAdminLogin ? 'white' : 'var(--text-secondary)', fontWeight: !isAdminLogin ? 'bold' : 'normal', borderBottom: !isAdminLogin ? '2px solid #38bdf8' : 'none', paddingBottom: '0.5rem', cursor: 'pointer' }}>Trader Login</button>
                        <button onClick={() => setIsAdminLogin(true)} style={{ background: 'none', border: 'none', color: isAdminLogin ? 'white' : 'var(--text-secondary)', fontWeight: isAdminLogin ? 'bold' : 'normal', borderBottom: isAdminLogin ? '2px solid #38bdf8' : 'none', paddingBottom: '0.5rem', cursor: 'pointer' }}>Admin Access</button>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '16px',
                            backgroundColor: isAdminLogin ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                            color: isAdminLogin ? '#ef4444' : '#38bdf8', margin: '0 auto 1.5rem auto',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
                        }}>{isAdminLogin ? '🛡️' : '⚡'}</div>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', color: 'white' }}>Pro {isAdminLogin ? 'Admin' : 'Exchange'}</h1>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            {isAdminLogin ? 'Log in with your administrator password' : 'Log in to access your high-speed wallet'}
                        </p>
                    </div>

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {!isAdminLogin ? (
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Username</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Alice"
                                    value={userId}
                                    onChange={e => setUserId(e.target.value)}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
                                    required
                                />
                            </div>
                        ) : (
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Admin Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={adminPassword}
                                    onChange={e => setAdminPassword(e.target.value)}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
                                    required
                                />
                            </div>
                        )}
                        <button type="submit" className={isAdminLogin ? "btn btn-sell" : "btn btn-buy"} style={{ padding: '0.8rem', fontSize: '1.1rem', width: '100%', marginTop: '0.5rem', fontWeight: 'bold' }}>
                            {isAdminLogin ? 'Authenticate Admin' : 'Connect Wallet'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (isAdmin && currentScreen !== 'lobby' && currentScreen !== 'room') {
        return (
            <div className="app-container" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '2rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '2rem' }}>🛡️</span> Pro Exchange Administrator
                        </h1>
                        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>System Oversight and Wallet Management</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button onClick={() => setCurrentScreen('lobby')} style={{ backgroundColor: '#ef4444', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold' }}>
                            🎲 Play God Mode
                        </button>
                        <button onClick={() => { setIsAdmin(false); setLoggedInUser(null); setAdminPassword(''); }} style={{ backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'white', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                            Logout Admin
                        </button>
                    </div>
                </header>

                <div className="panel" style={{ padding: '0' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontSize: '1.1rem' }}>Active User Wallets</span>
                        <button onClick={() => fetchAdminData(adminPassword)} className="btn btn-buy" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: '#38bdf8' }}>
                            ↻ Refresh
                        </button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        {Object.keys(adminUsersInfo).length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>No active users found on the exchange.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.75rem' }}>Wallet User</th>
                                        <th style={{ padding: '0.75rem' }}>USD Balance</th>
                                        <th style={{ padding: '0.75rem' }}>BTC Balance</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(adminUsersInfo).map(([user, data]) => (
                                        <tr key={user} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem 0.75rem', fontWeight: 'bold' }}>{user}</td>
                                            <td style={{ padding: '1rem 0.75rem', color: '#10b981' }}>${(data.USD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '1rem 0.75rem', color: '#f59e0b' }}>{(data.BTC || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="btn btn-sell"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                >
                                                    Delete Wallet
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (currentScreen === 'selection') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
                <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '20px',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8', margin: '0 auto 1.5rem auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
                    }}>⚡</div>
                    <h1 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 0.5rem 0' }}>Welcome, {loggedInUser}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Where would you like to go?</p>
                </div>

                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        onClick={() => setCurrentScreen('exchange')}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: '16px', padding: '3rem 2rem', width: '100%', maxWidth: '300px',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
                        }}
                    >
                        <span style={{ fontSize: '3rem' }}>📈</span>
                        <h2 style={{ margin: 0, color: 'white' }}>Pro Exchange</h2>
                        <span style={{ color: 'var(--text-secondary)' }}>Trade BTC/USD with ultra-low latency.</span>
                    </button>

                    <button
                        onClick={() => setCurrentScreen('lobby')}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: '16px', padding: '3rem 2rem', width: '100%', maxWidth: '300px',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
                        }}
                    >
                        <span style={{ fontSize: '3rem' }}>🎲</span>
                        <h2 style={{ margin: 0, color: 'white' }}>Prediction Game</h2>
                        <span style={{ color: 'var(--text-secondary)' }}>Play with friends in multiplayer rooms.</span>
                    </button>

                    <button
                        onClick={() => setCurrentScreen('poker-lobby')}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: '16px', padding: '3rem 2rem', width: '100%', maxWidth: '300px',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
                        }}
                    >
                        <span style={{ fontSize: '3rem' }}>🃏</span>
                        <h2 style={{ margin: 0, color: 'white' }}>Texas Hold'em</h2>
                        <span style={{ color: 'var(--text-secondary)' }}>Real poker with friends. Up to 8 players.</span>
                    </button>
                </div>
            </div>
        );
    }

    if (currentScreen === 'lobby') {
        const createRoom = async () => {
            const res = await fetch(`${API_BASE}/api/game/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser })
            });
            const roomData = await res.json();
            setActiveRoom(roomData);
            setIsHost(true);
            setCurrentScreen('room');
        };

        const joinRoom = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!lobbyCodeInput) return;
            const res = await fetch(`${API_BASE}/api/game/rooms/${lobbyCodeInput}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser })
            });
            if (res.ok) {
                const roomData = await res.json();
                setActiveRoom(roomData);
                setIsHost(false);
                setCurrentScreen('room');
            } else {
                alert("Room not found!");
            }
        };

        return (
            <div className="app-container" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '1rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setCurrentScreen('selection')} style={{ background: 'none', border: '1px solid var(--text-secondary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>← Back</button>
                        <h2 style={{ margin: 0, color: 'white' }}>🎲 Multiplayer Game Lobby</h2>
                    </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3rem', width: '100%' }}>
                    <button
                        onClick={createRoom}
                        className="btn btn-primary"
                        style={{ padding: '1.5rem 3rem', fontSize: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '350px' }}
                    >
                        ⚔️ Create New Room
                    </button>

                    <div style={{ color: 'var(--text-secondary)' }}>— OR —</div>

                    <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '350px' }}>
                        <input
                            type="text"
                            placeholder="Enter 4-Letter Room Code"
                            value={lobbyCodeInput}
                            onChange={e => setLobbyCodeInput(e.target.value.toUpperCase())}
                            style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'white', fontSize: '1.2rem', textAlign: 'center', textTransform: 'uppercase' }}
                            maxLength={4}
                        />
                        <button type="submit" className="btn btn-secondary" style={{ padding: '1.25rem', fontSize: '1.2rem', borderRadius: '8px' }}>
                            🚀 Join Room
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (currentScreen === 'room' && activeRoom) {

        const startRound = async () => {
            await fetch(`${API_BASE}/api/game/rooms/${activeRoom.roomId}/start`, { method: 'POST' });
        };

        const placeBet = async (option: string) => {
            setGamePrediction(option);
            await fetch(`${API_BASE}/api/game/rooms/${activeRoom.roomId}/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser, prediction: option })
            });
        };

        const rigGame = async (option: string) => {
            await fetch(`${API_BASE}/api/game/rooms/${activeRoom.roomId}/rig`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outcome: option })
            });
        };

        const currentOptions = activeRoom.currentEvent ?
            (activeRoom.currentEvent === 'Frog Jump' ? ['LEFT', 'RIGHT'] :
                activeRoom.currentEvent === 'Coin Flip' ? ['HEADS', 'TAILS'] :
                    activeRoom.currentEvent === 'Rocket Launch' ? ['ORBIT', 'CRASH'] :
                        activeRoom.currentEvent === 'Cat Mood' ? ['SLEEPY', 'CRAZY'] :
                            ['SUNNY', 'RAINY']) : ['A', 'B'];

        return (
            <div className="app-container" style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                {/* Main Game Interface */}
                <div style={{ flex: '1 1 600px', minWidth: '300px' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button onClick={() => { setActiveRoom(null); setCurrentScreen('lobby'); }} style={{ background: 'none', border: '1px solid var(--text-secondary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>← Leave Room</button>
                            <h2 style={{ margin: 0, color: 'white' }}>Room: <span style={{ color: '#38bdf8' }}>#{activeRoom.roomId}</span></h2>
                        </div>
                        <span style={{ color: 'var(--text-secondary)' }}>Host: {activeRoom.hostUserId}</span>
                    </header>

                    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                        {activeRoom.state === 'WAITING' && (
                            <div>
                                <h1 style={{ fontSize: '3rem', margin: '1rem 0 3rem 0', color: 'white' }}>Waiting for next round...</h1>
                                {isHost ? (
                                    <button onClick={startRound} className="btn btn-primary" style={{ padding: '1.5rem 4rem', fontSize: '1.5rem', borderRadius: '16px' }}>Begin Round</button>
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Waiting for host to start the game.</p>
                                )}
                            </div>
                        )}

                        {activeRoom.state === 'BETTING' && (
                            <div>
                                <span style={{ color: '#38bdf8', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Event: {activeRoom.currentEvent}</span>
                                <h1 style={{ fontSize: '3rem', margin: '1rem 0 3rem 0', color: 'white' }}>Place your $10 bet!</h1>

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                                    {[0, 1].map(index => {
                                        const opt = currentOptions[index];
                                        const isSelected = gamePrediction === opt;
                                        const isDisabled = !!gamePrediction;
                                        return (
                                            <button
                                                key={opt}
                                                className="btn btn-primary"
                                                disabled={isDisabled}
                                                onClick={() => placeBet(opt)}
                                                style={{
                                                    padding: '2rem 4rem', fontSize: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '300px',
                                                    backgroundColor: isSelected ? (index === 0 ? '#10b981' : '#ef4444') : 'var(--bg-secondary)',
                                                    border: `2px solid ${isSelected ? (index === 0 ? '#10b981' : '#ef4444') : 'var(--border-color)'}`,
                                                    color: isSelected ? 'white' : 'var(--text-secondary)',
                                                    opacity: isDisabled && !isSelected ? 0.3 : 1
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeRoom.state === 'RESOLVED' && (
                            <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
                                <h1 style={{ fontSize: '2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>The outcome is...</h1>
                                <h1 style={{ fontSize: '5rem', margin: '1rem 0 3rem 0', color: activeRoom.winningOption === currentOptions[0] ? '#10b981' : '#ef4444' }}>
                                    {activeRoom.winningOption}!
                                </h1>

                                {isHost && (
                                    <button onClick={startRound} className="btn btn-secondary" style={{ padding: '1rem 3rem', fontSize: '1.2rem', borderRadius: '12px' }}>Next Round</button>
                                )}
                            </div>
                        )}

                        {/* Admin God Mode Panel */}
                        {isAdmin && (
                            <div style={{ marginTop: '5rem', padding: '1rem', border: '1px dashed #ef4444', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <h4 style={{ color: '#ef4444', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>God Mode Control</h4>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                    <button disabled={activeRoom.state !== 'BETTING'} onClick={() => rigGame(currentOptions[0])} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: activeRoom.state === 'BETTING' ? 'pointer' : 'not-allowed', opacity: activeRoom.state === 'BETTING' ? 1 : 0.4 }}>Force {currentOptions[0]}</button>
                                    <button disabled={activeRoom.state !== 'BETTING'} onClick={() => rigGame(currentOptions[1])} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: activeRoom.state === 'BETTING' ? 'pointer' : 'not-allowed', opacity: activeRoom.state === 'BETTING' ? 1 : 0.4 }}>Force {currentOptions[1]}</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Leaderboard */}
                <div style={{ flex: '1 1 300px', maxWidth: '400px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Live Leaderboard</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activeRoom.players.map((p: string) => {
                            const pBal = activeRoom.playerBalances ? activeRoom.playerBalances[p] : 0;
                            const isMe = p === loggedInUser;
                            return (
                                <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: isMe ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-secondary)', borderRadius: '8px', border: isMe ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: p === activeRoom.hostUserId ? '#f59e0b' : '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 'bold' }}>
                                            {p.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ color: isMe ? 'white' : 'var(--text-secondary)', fontWeight: isMe ? 'bold' : 'normal' }}>{p}</span>
                                    </div>
                                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>${(pBal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ── POKER LOBBY ──
    if (currentScreen === 'poker-lobby') {
        const createPokerRoom = async () => {
            const res = await fetch(`${API_BASE}/api/poker/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser })
            });
            const roomData = await res.json();
            setPokerRoom(roomData);
            setIsHost(true);
            setCurrentScreen('poker-table');
        };

        const joinPokerRoom = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!pokerLobbyCode) return;
            const res = await fetch(`${API_BASE}/api/poker/rooms/${pokerLobbyCode}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUser })
            });
            if (res.ok) {
                const roomData = await res.json();
                setPokerRoom(roomData);
                setIsHost(false);
                setCurrentScreen('poker-table');
            } else {
                alert("Room not found!");
            }
        };

        return (
            <div className="app-container" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '1rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setCurrentScreen('selection')} style={{ background: 'none', border: '1px solid var(--text-secondary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>← Back</button>
                        <h2 style={{ margin: 0, color: 'white' }}>🃏 Texas Hold'em Lobby</h2>
                    </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3rem', width: '100%' }}>
                    <button
                        onClick={createPokerRoom}
                        className="btn btn-primary"
                        style={{ padding: '1.5rem 3rem', fontSize: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '350px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🃏 Create Poker Table
                    </button>

                    <div style={{ color: 'var(--text-secondary)' }}>— OR —</div>

                    <form onSubmit={joinPokerRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '350px' }}>
                        <input
                            type="text"
                            placeholder="Enter 4-Letter Room Code"
                            value={pokerLobbyCode}
                            onChange={e => setPokerLobbyCode(e.target.value.toUpperCase())}
                            style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'white', fontSize: '1.2rem', textAlign: 'center', textTransform: 'uppercase' }}
                            maxLength={4}
                        />
                        <button type="submit" className="btn btn-secondary" style={{ padding: '1.25rem', fontSize: '1.2rem', borderRadius: '8px', background: '#6366f1', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                            🚀 Join Table
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── POKER TABLE ──
    if (currentScreen === 'poker-table' && pokerRoom) {
        return (
            <PokerTable
                room={pokerRoom}
                loggedInUser={loggedInUser!}
                isHost={isHost}
                apiBase={API_BASE}
                onLeave={() => {
                    setPokerRoom(null);
                    setCurrentScreen('poker-lobby');
                }}
            />
        );
    }

    return (
        <div className="app-container">
            <header className="header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Trading Engine Visualizer {orderBook.symbol && `- ${orderBook.symbol}`}</h1>
                    <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={runAiPipeline}
                            disabled={isRunningAi}
                            style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                        >
                            {isRunningAi ? 'Running Agentic Pipeline...' : 'Run Agentic AI Demo'}
                        </button>
                        <div className="status-badge">
                            <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></div>
                            {connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                </div>

                {/* Wallet Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', width: '100%' }}>
                        <button onClick={() => setCurrentScreen('selection')} style={{ background: 'none', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>← Menu</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {loggedInUser?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 'bold' }}>{loggedInUser}</span>
                            <button onClick={() => { setLoggedInUser(null); setUserId(''); setCurrentScreen('login'); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '0.5rem', textDecoration: 'underline' }}>Logout</button>
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>USD Balance</span>
                                <span style={{ fontWeight: 'bold', color: '#10b981' }}>${balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>BTC Balance</span>
                                <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* TrueMarkets-Inspired Market Overview */}
            <div style={{ padding: '0 1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                {Object.entries(marketPrices).map(([symbol, data]) => {
                    const range = data.high - data.low;
                    const position = ((data.current - data.low) / range) * 100;
                    const isPositive = data.change >= 0;

                    return (
                        <div key={symbol} style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '12px',
                            padding: '1rem',
                            border: '1px solid var(--border-color)',
                            display: 'flex', flexDirection: 'column', gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8rem', fontWeight: 'bold'
                                    }}>
                                        {symbol}
                                    </div>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>${data.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{
                                    backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: isPositive ? '#10b981' : '#ef4444',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem', fontWeight: 'bold'
                                }}>
                                    {isPositive ? '+' : ''}{data.change}%
                                </div>
                            </div>

                            {/* TrueMarkets Sparkline Range Bar */}
                            <div style={{ position: 'relative', width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '0.5rem' }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '0',
                                    width: `${position}%`,
                                    height: '100%',
                                    backgroundColor: isPositive ? '#10b981' : '#ef4444',
                                    borderRadius: '3px'
                                }}></div>
                                <div style={{
                                    position: 'absolute',
                                    left: `calc(${position}% - 4px)`,
                                    top: '-4px',
                                    width: '14px', height: '14px',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                                }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                <span>24h Low: ${data.low.toLocaleString()}</span>
                                <span>24h High: ${data.high.toLocaleString()}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <main className="main-content">
                {aiReport && (
                    <section style={{
                        gridColumn: '1 / -1',
                        background: 'linear-gradient(145deg, rgba(30, 41, 59, 1) 0%, rgba(15, 23, 42, 1) 100%)',
                        border: '1px solid rgba(129, 140, 248, 0.3)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        position: 'relative',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                    }}>
                        <button onClick={() => setAiReport(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '8px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', flexShrink: 0
                            }}>
                                💡
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.1rem' }}>Personalized Market Insights</h3>
                                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                                    {aiReport}
                                </pre>
                            </div>
                        </div>
                    </section>
                )}

                {/* Strategy Editor Panel */}
                <section className="panel" style={{ gridColumn: '1 / -1' }}>
                    <div
                        className="panel-header"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setIsPlaygroundOpen(!isPlaygroundOpen)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{isPlaygroundOpen ? '▼' : '▶'}</span>
                            <span>Advanced Backtest Playground</span>
                        </div>
                        {chartData.length > 0 && isPlaygroundOpen && (
                            <button
                                className="btn btn-buy"
                                onClick={(e) => { e.stopPropagation(); getAiFeedback(); }}
                                disabled={isRunningAi}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                                Get LLM Strategy Feedback
                            </button>
                        )}
                    </div>

                    {isPlaygroundOpen && (
                        <div style={{ marginTop: '1rem', animation: 'fadeIn 0.2s ease-in-out' }}>
                            {/* Famous Strategy Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {['sma_crossover', 'rsi_mean_reversion', 'bollinger_breakout', 'macd_signal'].map(key => (
                                    <div
                                        key={key}
                                        onClick={() => setStrategyType(key)}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            border: strategyType === key ? '2px solid #818cf8' : '1px solid var(--border-color)',
                                            backgroundColor: strategyType === key ? 'rgba(129, 140, 248, 0.1)' : 'var(--bg-tertiary)',
                                            transition: 'all 0.2s',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{ fontSize: '1.5rem' }}>{STRATEGY_INFO[key].icon}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.25rem' }}>{STRATEGY_INFO[key].name}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Strategy Description */}
                            {STRATEGY_INFO[strategyType] && (
                                <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: '#38bdf8' }}>{STRATEGY_INFO[strategyType].icon} {STRATEGY_INFO[strategyType].name}:</strong> {STRATEGY_INFO[strategyType].description}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                                <form className="order-entry" onSubmit={runCustomStrategy} style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                    <div className="form-group" style={{ flexDirection: 'row', gap: '0.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label>Coin Selector</label>
                                            <select
                                                value={playgroundSymbol}
                                                onChange={(e: any) => setPlaygroundSymbol(e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                            >
                                                <option value="btcusd">BTC/USD</option>
                                                <option value="ethusd">ETH/USD</option>
                                                <option value="solusd">SOL/USD</option>
                                            </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label>Strategy Module</label>
                                            <select
                                                value={strategyType}
                                                onChange={(e: any) => setStrategyType(e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                            >
                                                <optgroup label="📈 Famous Strategies (Candle-Based)">
                                                    <option value="sma_crossover">SMA Crossover (10/30)</option>
                                                    <option value="rsi_mean_reversion">RSI Mean Reversion (14)</option>
                                                    <option value="bollinger_breakout">Bollinger Bands Breakout</option>
                                                    <option value="macd_signal">MACD Signal Line</option>
                                                </optgroup>
                                                <optgroup label="📋 Orderbook Strategies">
                                                    <option value="momentum">Momentum / Trend</option>
                                                    <option value="spread_arbitrage">Spread Arbitrage</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>

                                    {isCandleStrategy && (
                                        <div className="form-group">
                                            <label>Timeframe</label>
                                            <select
                                                value={timeframe}
                                                onChange={(e: any) => setTimeframe(e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                            >
                                                <option value="1m">1 Minute</option>
                                                <option value="5m">5 Minutes</option>
                                                <option value="15m">15 Minutes</option>
                                                <option value="30m">30 Minutes</option>
                                                <option value="1hr">1 Hour</option>
                                                <option value="6hr">6 Hours</option>
                                                <option value="1day">1 Day</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Aggression / Sizing Multiplier</label>
                                        <input type="number" step="0.1" value={aggression} onChange={(e: any) => setAggression(e.target.value)} required />
                                    </div>

                                    {!isCandleStrategy && (
                                        <>
                                            <div className="form-group">
                                                <label>Buy Activation Threshold (Offset)</label>
                                                <input type="number" step="0.0001" value={buyThreshold} onChange={(e: any) => setBuyThreshold(e.target.value)} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Sell Activation Threshold (Offset)</label>
                                                <input type="number" step="0.0001" value={sellThreshold} onChange={(e: any) => setSellThreshold(e.target.value)} required />
                                            </div>
                                        </>
                                    )}

                                    <button type="submit" className="btn btn-primary" disabled={isRunningAi} style={{ marginTop: '1rem', width: '100%', backgroundColor: '#4f46e5' }}>
                                        {isRunningAi ? 'Running Backtest...' : 'Run C++ Backtest Simulation'}
                                    </button>

                                    {strategyMetrics && (
                                        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                            <h4 style={{ margin: '0 0 1rem 0' }}>Quantitative Metrics</h4>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total PnL</div>
                                                    <div className={strategyMetrics.simulated_pnl >= 0 ? 'price-buy' : 'price-ask'} style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                        ${strategyMetrics.simulated_pnl.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Win Rate</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                        {(strategyMetrics.win_rate * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sharpe Ratio</div>
                                                    <div className={strategyMetrics.sharpe_ratio >= 1.0 ? 'price-buy' : ''} style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                        {strategyMetrics.sharpe_ratio.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max Drawdown</div>
                                                    <div className="price-ask" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                        -${strategyMetrics.max_drawdown.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Core Latency</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>
                                                        {strategyMetrics.avg_latency_us.toFixed(2)} µs
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Orders Handled</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                        {strategyMetrics.total_orders}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </form>

                                <div style={{ height: '350px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', padding: '1rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>PnL Trajectory Chart</h4>
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="85%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="trade" stroke="#888" />
                                                <YAxis stroke="#888" />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #444' }}
                                                    itemStyle={{ color: '#fff' }}
                                                />
                                                <Line type="monotone" dataKey="pnl" stroke="#38bdf8" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                            Run a strategy to generate chart...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Order Entry Panel */}
                <section className="panel">
                    <div className="panel-header">Place Order</div>
                    <form className="order-entry" onSubmit={submitOrder}>
                        <div className="form-group" style={{ flexDirection: 'row', gap: '1rem' }}>
                            <button
                                type="button"
                                className={`btn ${orderSide === 'BUY' ? 'btn-buy' : ''}`}
                                style={{ flex: 1, backgroundColor: orderSide !== 'BUY' ? 'var(--bg-tertiary)' : undefined }}
                                onClick={() => setOrderSide('BUY')}
                            >
                                BUY
                            </button>
                            <button
                                type="button"
                                className={`btn ${orderSide === 'SELL' ? 'btn-sell' : ''}`}
                                style={{ flex: 1, backgroundColor: orderSide !== 'SELL' ? 'var(--bg-tertiary)' : undefined }}
                                onClick={() => setOrderSide('SELL')}
                            >
                                SELL
                            </button>
                        </div>

                        <div className="form-group">
                            <label>Price</label>
                            <input
                                type="number"
                                step="0.01"
                                value={orderPrice}
                                onChange={e => setOrderPrice(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Size</label>
                            <input
                                type="number"
                                min="1"
                                value={orderSize}
                                onChange={e => setOrderSize(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className={`btn ${orderSide === 'BUY' ? 'btn-buy' : 'btn-sell'}`} style={{ marginTop: '1rem' }}>
                            Submit {orderSide} Order
                        </button>
                    </form>

                    {/* Telemetry Dashboard */}
                    <div className="telemetry-dashboard">
                        <div className="telemetry-title">Performance Telemetry</div>
                        <div className="telemetry-grid">
                            <div className="metric-card">
                                <div className="label">End-to-End Latency</div>
                                <div className={`value ${metrics.latencyUs > 0 ? 'good' : ''}`}>
                                    {metrics.latencyUs > 0 ? `${metrics.latencyUs.toFixed(2)} µs` : '---'}
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="label">Hot Path Allocations</div>
                                <div className={`value ${metrics.allocations === 0 && metrics.latencyUs > 0 ? 'good' : ''}`}>
                                    {metrics.latencyUs > 0 ? metrics.allocations : '---'}
                                </div>
                            </div>
                            <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                                <div className="label">Active CPU Core (Affinity)</div>
                                <div className="value" style={{ color: 'var(--text-primary)' }}>
                                    {metrics.coreId >= 0 ? `Core ${metrics.coreId}` : 'Unpinned'}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Order Book Panel */}
                <section className="panel">
                    <div className="panel-header">Order Book</div>
                    <div className="order-book-container">
                        <div className="book-header">
                            <span>Price</span>
                            <span>Size</span>
                        </div>

                        {/* Asks (Sells) - Render reversed so lowest price is at the bottom */}
                        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
                            {orderBook.asks.map((ask, i) => (
                                <div key={ask.price} className="book-row price-ask">
                                    <div className="depth-bar ask" style={{ width: `${(ask.size / maxDepthSize) * 100}%` }}></div>
                                    <span>{ask.price.toFixed(2)}</span>
                                    <span>{ask.size}</span>
                                </div>
                            ))}
                        </div>

                        <div className="spread-row">
                            {orderBook.asks.length > 0 && orderBook.bids.length > 0
                                ? `Spread: ${(orderBook.asks[0].price - orderBook.bids[0].price).toFixed(2)}`
                                : '---'}
                        </div>

                        {/* Bids (Buys) */}
                        <div>
                            {orderBook.bids.map((bid, i) => (
                                <div key={bid.price} className="book-row price-buy">
                                    <div className="depth-bar buy" style={{ width: `${(bid.size / maxDepthSize) * 100}%` }}></div>
                                    <span>{bid.price.toFixed(2)}</span>
                                    <span>{bid.size}</span>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>

                {/* Trade History Panel */}
                <section className="panel">
                    <div className="panel-header">Recent Trades</div>
                    <div className="trades-list">
                        <div className="book-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <span>Price</span>
                            <span style={{ textAlign: 'center' }}>Size</span>
                            <span>Time</span>
                        </div>
                        {trades.map(trade => (
                            <div key={trade.id} className="trade-row">
                                <span>{trade.price.toFixed(2)}</span>
                                <span>{trade.size}</span>
                                <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))}
                        {trades.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                                No trades yet
                            </div>
                        )}
                    </div>
                </section>

            </main>
        </div>
    );
}

export default App;
