import { Pool } from "pg";
import universe from "../data/universe.json";
import symbolMeta from "../data/symbol_meta.json";

type SignalRow = {
  symbol: string;
  symbol_name: string;
  market: string;
  timeframe: string;
  signal: string;
  price: string | number | null;
  signal_price: string | number | null;
  bars_ago: number | null;
  ts: string;
};

type UniverseFile = { symbols?: string[] };
type MetaEntry = { name?: string; market?: string };

const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
const hasPlaceholderDbUrl = /user:pass@host/.test(rawDatabaseUrl);
const useNoDbMode = !rawDatabaseUrl || hasPlaceholderDbUrl;
const pool = useNoDbMode ? null : new Pool({ connectionString: rawDatabaseUrl });

const meta = symbolMeta as Record<string, MetaEntry>;

function metaFor(symbol: string): { symbol_name: string; market: string } {
  const entry = meta[symbol] || {};
  const market = entry.market || (symbol.includes(":") ? symbol.split(":", 1)[0] : "UNKNOWN");
  const fallbackName = symbol.includes(":") ? symbol.split(":", 2)[1] : symbol;
  return {
    symbol_name: entry.name || fallbackName,
    market,
  };
}

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
      ...metaFor(symbol),
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
  const latest = new Map<string, Omit<SignalRow, "symbol_name" | "market">>();
  for (const r of rows as Omit<SignalRow, "symbol_name" | "market">[]) {
    latest.set(String(r.symbol).toUpperCase(), r);
  }

  return universeSymbols.slice(0, cap).map((symbol) => {
    const m = metaFor(symbol);
    const row = latest.get(symbol);
    if (row) return { ...row, ...m };
    return {
      symbol,
      ...m,
      timeframe,
      signal: "NEUTRAL",
      price: null,
      signal_price: null,
      bars_ago: null,
      ts: new Date(0).toISOString(),
    };
  });
}
