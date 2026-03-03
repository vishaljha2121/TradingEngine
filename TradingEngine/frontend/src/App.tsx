import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
}

interface Metrics {
    latencyUs: number;
    allocations: number;
    coreId: number;
}

function App() {
    const [connected, setConnected] = useState(false);
    const [orderBook, setOrderBook] = useState<OrderBookSnapshot>({ symbol: '', bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ latencyUs: 0, allocations: 0, coreId: -1 });

    const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderPrice, setOrderPrice] = useState<string>('50000');
    const [orderSize, setOrderSize] = useState<string>('1');
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isRunningAi, setIsRunningAi] = useState(false);

    // Strategy Panel State
    const [playgroundSymbol, setPlaygroundSymbol] = useState<string>('btcusd');
    const [strategyType, setStrategyType] = useState<string>('momentum');
    const [aggression, setAggression] = useState<string>('1.0');
    const [buyThreshold, setBuyThreshold] = useState<string>('0.0001');
    const [sellThreshold, setSellThreshold] = useState<string>('0.0001');
    const [chartData, setChartData] = useState<any[]>([]);
    const [strategyMetrics, setStrategyMetrics] = useState<any>(null);

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const res = await fetch(`http://localhost:12000/api/marketdata/${playgroundSymbol}`);
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
            .withUrl("http://localhost:12000/tradinghub")
            .withAutomaticReconnect()
            .build();

        connection.on("OrderBookUpdated", (snapshot: OrderBookSnapshot) => {
            setOrderBook(snapshot);
        });

        connection.on("ReceiveTrade", (trade: Trade) => {
            setTrades(prev => [trade, ...prev].slice(0, 50)); // Keep last 50 trades
        });

        connection.on("ReceiveMetrics", (m: Metrics) => {
            setMetrics(m);
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
        if (!orderPrice || !orderSize) return;

        try {
            await fetch('http://localhost:12000/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    isBuy: orderSide === 'BUY',
                    price: parseFloat(orderPrice),
                    size: parseInt(orderSize),
                }),
            });
        } catch (err) {
            console.error("Failed to submit order", err);
        }
    };

    const runAiPipeline = async () => {
        setIsRunningAi(true);
        setAiReport(null);
        try {
            const res = await fetch('http://localhost:12000/api/run-backtest', {
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
            const res = await fetch('http://localhost:12000/api/run-custom-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: playgroundSymbol,
                    strategyType: strategyType,
                    aggression: parseFloat(aggression),
                    buyThreshold: parseFloat(buyThreshold),
                    sellThreshold: parseFloat(sellThreshold)
                })
            });
            const data = await res.json();

            setStrategyMetrics({
                total_orders: data.total_orders,
                avg_latency_us: data.avg_latency_us,
                max_latency_us: data.max_latency_us,
                simulated_pnl: data.simulated_pnl,
                win_rate: data.win_rate,
                max_drawdown: data.max_drawdown,
                sharpe_ratio: data.sharpe_ratio
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
            const res = await fetch('http://localhost:12000/api/ai-feedback', { method: 'POST' });
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

    return (
        <div className="app-container">
            <header className="header">
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
            </header>

            <main className="main-content">
                {aiReport && (
                    <section className="panel" style={{ gridColumn: '1 / -1', backgroundColor: '#1e1e2e', border: '1px solid var(--accent)' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>AI Agent Insights (HFT Backtest)</span>
                            <button onClick={() => setAiReport(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                        </div>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', color: '#a6accd', padding: '1rem', overflowX: 'auto', margin: 0 }}>
                            {aiReport}
                        </pre>
                    </section>
                )}

                {/* Strategy Editor Panel */}
                <section className="panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Advanced Backtest Playground</span>
                        {chartData.length > 0 && (
                            <button
                                className="btn btn-buy"
                                onClick={getAiFeedback}
                                disabled={isRunningAi}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                                Get LLM Strategy Feedback
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                        <form className="order-entry" onSubmit={runCustomStrategy} style={{ maxHeight: '450px', overflowY: 'auto' }}>
                            <div className="form-group" style={{ flexDirection: 'row', gap: '0.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Coin Selector</label>
                                    <select
                                        value={playgroundSymbol}
                                        onChange={e => setPlaygroundSymbol(e.target.value)}
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
                                        onChange={e => setStrategyType(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    >
                                        <option value="momentum">Momentum / Trend</option>
                                        <option value="spread_arbitrage">Spread Arbitrage</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Aggression / Sizing Multiplier</label>
                                <input type="number" step="0.1" value={aggression} onChange={e => setAggression(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Buy Activation Threshold (Offset)</label>
                                <input type="number" step="0.0001" value={buyThreshold} onChange={e => setBuyThreshold(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Sell Activation Threshold (Offset)</label>
                                <input type="number" step="0.0001" value={sellThreshold} onChange={e => setSellThreshold(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={isRunningAi} style={{ marginTop: '1rem', width: '100%', backgroundColor: '#4f46e5' }}>
                                Run C++ Backtest Simulation
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
