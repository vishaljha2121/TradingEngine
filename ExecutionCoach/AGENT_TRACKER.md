# Execution Coach - Agent Development Tracker

## Purpose
This document tracks decisions made, methods tried, blockers encountered, and best-practice resolutions for the Execution Coach project. This conserves contextual history and speeds up future development by providing established solutions to local environment quirks.

## Environment Constraints
- **Workspace Bounds**: Agent actions are sandboxed to the `TradingEngineServer` repository.
  - *Fix used*: Target the `ExecutionCoach` directory *inside* `TradingEngineServer`, configuring it with a `Dockerfile` so it can be dragged-and-dropped anywhere safely upon completion without breaking dependencies.
- **Node.js Version Conflict**: `create-vite` required Node.js 20+, but the host environment defaults to Node 14.15.4 / npm 8.18.0.
  - *Failed Attempts*: Direct `npx create-vite` (failed due to outdated JS semantics like `||=`). Attempted `brew install node` but terminated due to slow download/updates. Tried inline nvm.
  - *Working Fix*: Prepend commands with `npx -p node@22 --`. For example, `npx -p node@22 -- npm create vite@latest --yes . -- --template react-ts`. This avoids touching global environments, succeeds predictably, and respects system bounds.

## Current Setup Details
- **Architecture**: Vite React application initialized in `ExecutionCoach/frontend`.
- **CSS**: Installed `tailwindcss`, `postcss`, `autoprefixer`, and `lucide-react`.
- **Pattern**: Clean Architecture layered folders (`domain`, `application`, `infrastructure`, `presentation`) are pending setup.

## Best Practices Established for Scope
1. **Always use Node 22 wrappers**: E.g., `npx -p node@22 -- npm run build` or similar when issuing any npm/vite bash commands.
2. **Docker Containment**: Ensure all moving parts operate perfectly in Docker in case the agent breaks the host Node environment.
3. **No Direct OS Modifications**: Keep changes local to the `frontend` folder and avoid global installations (`-g`).

## Blockers Recorded during Build & Run
### PostCSS vs TailwindCSS v4 Crash
- **Symptom**: Running `npm run dev` threw a critical Vite/PostCSS error: `It looks like you're trying to use tailwindcss directly as a PostCSS plugin... update your PostCSS configuration.`
- **Root Cause**: `npm install tailwindcss` defaulted to Tailwind v4, which fundamentally changes its PostCSS integration and removes the familiar `tailwind.config` system in favor of an exclusive CSS-variable architecture or Vite `@tailwindcss/vite` plugin.
- **Action/Fix Required**: For a codebase built tightly on Tailwind v3 paradigms (like the TrueMarkets specific custom palette and `tailwind.config.mjs`), upgrading the integration to v4 requires overhauling the whole CSS setup. The quickest, most robust fix meant terminating the dev server, running `npx -p node@22 -- npm install -D tailwindcss@3 postcss autoprefixer` to downgrade cleanly to the massively stable v3.4 branch that matches our configs identically.
