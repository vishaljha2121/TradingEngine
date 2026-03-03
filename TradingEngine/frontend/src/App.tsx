import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

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

    // Calculate max size for depth bars
    const maxBidSize = Math.max(...orderBook.bids.map(b => b.size), 1);
    const maxAskSize = Math.max(...orderBook.asks.map(a => a.size), 1);
    const maxDepthSize = Math.max(maxBidSize, maxAskSize);

    return (
        <div className="app-container">
            <header className="header">
                <h1>Trading Engine Visualizer {orderBook.symbol && `- ${orderBook.symbol}`}</h1>
                <div className="status-badge">
                    <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></div>
                    {connected ? 'Connected' : 'Disconnected'}
                </div>
            </header>

            <main className="main-content">

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
                            {orderBook.asks.slice(0, 15).map((ask, i) => (
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
                            {orderBook.bids.slice(0, 15).map((bid, i) => (
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
