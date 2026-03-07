import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

type SignalRow = {
  symbol: string;
  timeframe: string;
  signal: string;
  price: string | number | null;
  signal_price: string | number | null;
  bars_ago: number | null;
  ts: string;
};

const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
const hasPlaceholderDbUrl = /user:pass@host/.test(rawDatabaseUrl);
const useNoDbMode = !rawDatabaseUrl || hasPlaceholderDbUrl;
const pool = useNoDbMode ? null : new Pool({ connectionString: rawDatabaseUrl });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const universePath = path.join(__dirname, "..", "data", "universe.json");

function loadUniverse(): string[] {
  try {
    const raw = readFileSync(universePath, "utf8");
    const parsed = JSON.parse(raw) as { symbols?: string[] };
    return Array.isArray(parsed.symbols) ? parsed.symbols : [];
  } catch {
    return [];
  }
}

export async function getLatestSignals(limit = 10000, timeframe = "weekly"): Promise<SignalRow[]> {
  const universe = loadUniverse().filter((s) => s && !s.includes("SPARE"));
  const cap = Math.max(1, limit);

  if (!pool) {
    return universe.slice(0, cap).map((symbol) => ({
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
    latest.set(r.symbol, r);
  }

  return universe.slice(0, cap).map((symbol) => {
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
