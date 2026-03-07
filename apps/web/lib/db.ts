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

export async function getLatestSignals(limit = 10000, timeframe = "weekly"): Promise<SignalRow[]> {
  if (!pool) {
    return [];
  }

  const sql = `
    with latest_runs as (
      select id
      from scan_runs
      where timeframe = $2
        and status = 'success'
      order by started_at desc
      limit 50
    )
    select s.symbol, s.timeframe, s.signal, s.price, s.signal_price, s.bars_ago, s.ts
    from signals s
    where s.run_id in (select id from latest_runs)
      and s.symbol not like '%SPARE%'
      and s.timeframe = $2
    order by s.ts desc
    limit $1
  `;

  const { rows } = await pool.query(sql, [limit, timeframe]);
  return rows as SignalRow[];
}
