# Deployment Blueprint

## 1) Vercel Web App
- Root directory: `apps/web`
- Build command: `pnpm build`
- Install command: `pnpm install`
- Runtime env vars:
  - `DATABASE_URL`

## 2) Worker (GitHub Actions)
- Workflow: `.github/workflows/worker-daily-scan.yml`
- Schedule: daily at `00:00 UTC`
- Matrix: groups `1..50`
- Secrets:
  - `DATABASE_URL`
  - `SCAN_TIMEFRAME` (`daily`, `weekly`, `monthly`)

## 3) Database
- Provider: Neon or Supabase free Postgres
- Run `packages/db/schema.sql`
- Tables:
  - `scan_runs`
  - `signals`

## 4) UT Logic Reuse
- Worker uses `apps/worker/src/ut_logic.py`, matching your existing UT approach.
- It is isolated in this new repo, so no edits are needed in the current scanner app.

## 5) Symbol Provider Mapping
- Edit `config/provider_map.json` to map TradingView-style symbols to Yahoo symbols.
- Example: `BTCUSDT -> BTC-USD`.

## 6) Data Flow
1. GitHub Actions triggers 50 group jobs once/day.
2. Each job runs one group worker and writes latest signal rows to Postgres.
3. Vercel reads latest rows for dashboard/API.

## 7) Near-Zero Cost Controls
- Once/day cadence.
- 200 tickers split into 50 groups.
- Keep job runtime short and cache dependencies.
