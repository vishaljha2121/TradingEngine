# Execution Coach - Architecture & Infrastructure

## Overview
Execution Coach is a pre-trade decision support tool designed to simulate the impact of execution size, market latency, and underlying asset volatility on trade outcomes. It provides adaptive recommendations to users (Execute Now, Slice, Defensive) based on quantitative metrics and specific risk guards.

## Phase 1 Architecture (Standalone Frontend)

### Technical Stack
- **Framework**: React via Vite (`react-ts` template).
- **Styling**: Tailwind CSS (extending bespoke True Markets color tokens).
- **State Management**: React Hooks (context-isolated where appropriate).

### Clean Architecture Layers
We adhere closely to Uncle Bob's Clean Architecture principles adapted for the Frontend to ensure a strong separation of concerns. This allows components like the matching engine or the quoting module to be seamlessly hot-swapped for Phase 2.

#### 1. Domain Layer (`src/domain/`)
- Contains enterprise business rules. Fully agnostic of React or external libraries.
- **Models/Entities**: `Quote`, `TradeContext` (Size, Side, Asset), `ExecutionMode` (Now, Slice, Defensive).
- **Use Cases/Services**: `RecommendationEngine` (Scores parameters and outputs a favored execution route), `RiskManager` (Evaluates against constraints like max inventory or severe latency threshold).

#### 2. Application Layer / State (`src/application/`)
- Contains application-specific business rules.
- Manages the orchestration of Domain Use Cases.
- Ties Domain rules to state objects consumed by React elements.

#### 3. Infrastructure Level (`src/infrastructure/`)
- External adapters and implementation details.
- **Market Data Feed**: Plugs into Gemini's public WSS (`wss://api.gemini.com/v1/marketdata/`) for live quotes. Includes fallback patterns (retries > Mock Data) to guarantee the demo never fails on stage.
- **Mock Simulation**: Hardcoded scenario generators used to force deterministic states during the Pitch.

#### 4. Presentation Layer (`src/presentation/`)
- **Components**: UI blocks (QuotePanel, LatencyToggle, Layout).
- **Pages**: Root Dashboard mapping Application state to UI.
- All styles configured using `tmaccent`, `tmblue`, and `tmgray` to match True Markets aesthetics.

## Containerization
- **Dockerfile**: Project is bundled with a local container config for absolute portability. It can be spun up as an isolated lightweight React instance independent of the Trading Engine.
