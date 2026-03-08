import { Pool } from "pg";
import universe from "../data/universe.json";
import symbolMeta from "../data/symbol_meta.json";
import manualBackfill from "../data/manual_backfill.json";

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
type BackfillEntry = {
  timeframe?: string;
  signal?: string;
  price?: string | number | null;
  signal_price?: string | number | null;
  bars_ago?: number | null;
};

const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
const hasPlaceholderDbUrl = /user:pass@host/.test(rawDatabaseUrl);
const useNoDbMode = !rawDatabaseUrl || hasPlaceholderDbUrl;
const pool = useNoDbMode ? null : new Pool({ connectionString: rawDatabaseUrl });

const meta = symbolMeta as Record<string, MetaEntry>;
const backfill = manualBackfill as Record<string, BackfillEntry>;

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

function applyBackfill(symbol: string, timeframe: string, row: Omit<SignalRow, "symbol_name" | "market">): Omit<SignalRow, "symbol_name" | "market"> {
  const b = backfill[symbol];
  if (!b) return row;
  if ((b.timeframe || timeframe).toLowerCase() !== row.timeframe.toLowerCase()) return row;

  const needsBackfill = row.price == null || row.signal_price == null || row.bars_ago == null;
  if (!needsBackfill) return row;

  return {
    ...row,
    signal: row.signal || b.signal || "NEUTRAL",
    price: row.price ?? b.price ?? null,
    signal_price: row.signal_price ?? b.signal_price ?? null,
    bars_ago: row.bars_ago ?? b.bars_ago ?? null,
  };
}

function backfillOnly(symbol: string, timeframe: string): Omit<SignalRow, "symbol_name" | "market"> {
  const b = backfill[symbol];
  if (!b || (b.timeframe || timeframe).toLowerCase() !== timeframe.toLowerCase()) {
    return {
      symbol,
      timeframe,
      signal: "NEUTRAL",
      price: null,
      signal_price: null,
      bars_ago: null,
      ts: new Date(0).toISOString(),
    };
  }

  return {
    symbol,
    timeframe,
    signal: b.signal || "NEUTRAL",
    price: b.price ?? null,
    signal_price: b.signal_price ?? null,
    bars_ago: b.bars_ago ?? null,
    ts: new Date(0).toISOString(),
  };
}

export async function getLatestSignals(limit = 10000, timeframe = "weekly"): Promise<SignalRow[]> {
  const universeSymbols = loadUniverse();
  const cap = Math.max(1, limit);

  if (!pool) {
    return universeSymbols.slice(0, cap).map((symbol) => ({
      ...backfillOnly(symbol, timeframe),
      ...metaFor(symbol),
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
    if (row) return { ...applyBackfill(symbol, timeframe, row), ...m };
    return { ...backfillOnly(symbol, timeframe), ...m };
  });
}
