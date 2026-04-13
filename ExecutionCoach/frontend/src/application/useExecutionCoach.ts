import { useState, useEffect, useRef } from 'react';
import type { Quote, TradeContext, RiskState, RecommendationResult } from '../domain/types';
import { marketDataFeed } from '../infrastructure/MarketDataProvider';

export const useExecutionCoach = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  
  // Base Context (What the user selects)
  const [context, setContext] = useState<TradeContext>({
    asset: 'BTC/USD',
    side: 'BUY',
    sizeUsd: 10000,
    latency: 'Nominal'
  });

  // Base Risk State (Can be modified for demo edge cases)
  const [riskState, setRiskState] = useState<RiskState>({
    currentInventoryUsd: 50000
  });

  // Derived Results
  const [evaluations, setEvaluations] = useState<RecommendationResult[]>([]);
  const [recommended, setRecommended] = useState<RecommendationResult | null>(null);

  // Subscribe to Market Data
  useEffect(() => {
    const id = 'coach-view-' + Math.random();
    marketDataFeed.subscribe(id, (newQuote: Quote) => {
      setQuote(newQuote);
    });

    return () => {
      marketDataFeed.unsubscribe(id);
    };
  }, []);

  // Ref to hold the debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recalculate evaluations whenever context, quote, or risk changes, but safely debounced
  useEffect(() => {
    if (!quote) return;

    const fetchSimulations = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    side: context.side,
                    sizeUsd: context.sizeUsd,
                    latency: context.latency,
                    currentQuote: { bid: quote.bid, ask: quote.ask },
                    inventoryUsd: riskState.currentInventoryUsd
                })
            });
            const data = await res.json();
            setEvaluations(data.evaluations || []);
            setRecommended(data.recommended || null);
        } catch (e) {
            console.error("ExecutionCoach: API Error, ensure backend is running at :8000", e);
        }
    };
    
    // Clear existing timer if dependencies change rapidly
    if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce by 400ms to allow smooth slider dragging and websocket throttling
    debounceTimerRef.current = setTimeout(() => {
        fetchSimulations();
    }, 400);

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [quote?.bid, quote?.ask, context, riskState]);

  const updateContext = (updates: Partial<TradeContext>) => {
    setContext(prev => ({ ...prev, ...updates }));
  };

  const updateRisk = (updates: Partial<RiskState>) => {
    setRiskState(prev => ({ ...prev, ...updates }));
  };

  const triggerFeatureDemoMode = (scenario: 'Nominal' | 'StressedVolatility') => {
      marketDataFeed.triggerMockScenario(scenario);
      if (scenario === 'StressedVolatility') {
          updateContext({ latency: 'Stressed' });
      } else {
          updateContext({ latency: 'Nominal' });
      }
  };

  return {
    quote,
    context,
    riskState,
    evaluations,
    recommended,
    updateContext,
    updateRisk,
    triggerFeatureDemoMode
  };
};
