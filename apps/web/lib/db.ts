import { Pool } from "pg";
import universe from "../data/universe.json";

type SignalRow = {
  symbol: string;
  timeframe: string;
  signal: string;
  price: string | number | null;
  signal_price: string | number | null;
  bars_ago: number | null;
  ts: string;
};

type UniverseFile = { symbols?: string[] };

const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
const hasPlaceholderDbUrl = /user:pass@host/.test(rawDatabaseUrl);
const useNoDbMode = !rawDatabaseUrl || hasPlaceholderDbUrl;
const pool = useNoDbMode ? null : new Pool({ connectionString: rawDatabaseUrl });

function loadUniverse(): string[] {
  const parsed = universe as UniverseFile;
  const symbols = Array.isArray(parsed.symbols) ? parsed.symbols : [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const s of symbols) {
    const tv = String(s || "").trim().toUpperCase();
    if (!tv || tv.includes("SPARE")) continue;
    if (seen.has(tv)) continue;
    seen.add(tv);
    out.push(tv);
  }

  return out;
}

export async function getLatestSignals(limit = 10000, timeframe = "weekly"): Promise<SignalRow[]> {
  const universeSymbols = loadUniverse();
  const cap = Math.max(1, limit);

  if (!pool) {
    return universeSymbols.slice(0, cap).map((symbol) => ({
      symbol,
      timeframe,
      signal: "NEUTRAL",
      price: null,
      signal_price: null,
      bars_ago: null,
      ts: new Date(0).toISOString(),
    }));
  }

  const sql = `
    select distinct on (s.symbol, s.timeframe)
      s.symbol, s.timeframe, s.signal, s.price, s.signal_price, s.bars_ago, s.ts
    from signals s
    where s.timeframe = $1
    order by s.symbol, s.timeframe, s.ts desc
  `;

  const { rows } = await pool.query(sql, [timeframe]);
  const latest = new Map<string, SignalRow>();
  for (const r of rows as SignalRow[]) {
    latest.set(String(r.symbol).toUpperCase(), r);
  }

  return universeSymbols.slice(0, cap).map((symbol) => {
    const row = latest.get(symbol);
    if (row) return row;
    return {
      symbol,
      timeframe,
      signal: "NEUTRAL",
      price: null,
      signal_price: null,
      bars_ago: null,
      ts: new Date(0).toISOString(),
    };
  });
}
