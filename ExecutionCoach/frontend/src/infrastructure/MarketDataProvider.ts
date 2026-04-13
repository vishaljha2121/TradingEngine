import type { Quote } from '../domain/types';

export type QuoteCallback = (quote: Quote) => void;

interface Subscription {
  id: string;
  callback: QuoteCallback;
}

export class MarketDataProvider {
  private ws: WebSocket | null = null;

  private retryCount = 0;
  private subscribers: Subscription[] = [];
  private fallbackInterval: ReturnType<typeof setInterval> | null = null;

  private currentMockBid = 101.20;
  private currentMockAsk = 101.60;

  constructor() {
    this.connect();
  }

  public subscribe(id: string, callback: QuoteCallback) {
    this.subscribers.push({ id, callback });
  }

  public unsubscribe(id: string) {
    this.subscribers = this.subscribers.filter(sub => sub.id !== id);
  }

  private publish(quote: Quote) {
    this.subscribers.forEach(sub => sub.callback(quote));
  }

  private connect() {
    if (this.retryCount >= 3) {
      console.warn("ExecutionCoach: Gemini WebSocket connection failed 3 times. Falling back to Mock Data provider.");
      this.startMockFallback();
      return;
    }

    try {
      this.ws = new WebSocket('wss://api.gemini.com/v1/marketdata/BTCUSD');

      this.ws.onopen = () => {
        console.log('ExecutionCoach: Connected to Gemini Market Data.');
        this.retryCount = 0; // Reset on success
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'update' && data.events && data.events.length > 0) {
            // Find Top of Book changes (simplified heuristic for demo)
            // Gemini streams changes, so we'd track orderbook if full, but for MVP we take top changes if available.
            let bid = 0;
            let ask = 0;
            
            for (const update of data.events) {
               if (update.type === 'change') {
                 const price = parseFloat(update.price);
                 if (update.side === 'bid') bid = price;
                 if (update.side === 'ask') ask = price;
               }
            }

            // Publish if we have reasonable data and difference
            if (bid > 0 && ask > 0 && ask > bid) {
               this.publish({ bid, ask, provider: 'Gemini' });
            }
          }
        } catch (e) {
          // Ignore parse errors on heartbeat
        }
      };

      this.ws.onerror = (err) => {
        console.error('ExecutionCoach: WebSocket Error:', err);
      };

      this.ws.onclose = () => {
        console.log('ExecutionCoach: WebSocket Closed. Retrying...');
        this.retryCount++;
        setTimeout(() => this.connect(), 2000);
      };
    } catch (err) {
      this.retryCount++;
      setTimeout(() => this.connect(), 2000);
    }
  }

  // --- HARDCODED SCENARIO MOCKS FOR DEMO PURPOSES ---

  private startMockFallback() {
    if (this.fallbackInterval) clearInterval(this.fallbackInterval);
    
    // Simulate active market jitter every 1.5 seconds
    this.fallbackInterval = setInterval(() => {
        const jitter = (Math.random() - 0.5) * 0.5;
        this.currentMockBid = Math.max(10, this.currentMockBid + jitter);
        this.currentMockAsk = this.currentMockBid + 0.40;

        this.publish({
            bid: parseFloat(this.currentMockBid.toFixed(2)),
            ask: parseFloat(this.currentMockAsk.toFixed(2)),
            provider: 'Mock'
        });
    }, 1500);
  }

  // Manually force a specific scenario for demo presentation
  public triggerMockScenario(scenario: 'Nominal' | 'StressedVolatility') {
      if (this.ws) {
          this.ws.close(); // Force kill real connection
          this.retryCount = 99; // Prevent reconnect
      }

      if (scenario === 'StressedVolatility') {
          // Immediately widen the spread significantly
          this.currentMockBid = 100.00;
          this.currentMockAsk = 105.00; 
      } else {
          this.currentMockBid = 101.20;
          this.currentMockAsk = 101.60;
      }
      
      this.publish({ bid: this.currentMockBid, ask: this.currentMockAsk, provider: 'Mock' });
  }

  public destroy() {
    if (this.ws) this.ws.close();
    if (this.fallbackInterval) clearInterval(this.fallbackInterval);
  }
}

// Singleton export
export const marketDataFeed = new MarketDataProvider();
