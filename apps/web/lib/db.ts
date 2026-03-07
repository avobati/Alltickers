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
    with latest_group_runs as (
      select distinct on (group_id)
        id, group_id
      from scan_runs
      where timeframe = $2
        and status = 'success'
      order by group_id, started_at desc
    )
    select s.symbol, s.timeframe, s.signal, s.price, s.signal_price, s.bars_ago, s.ts
    from signals s
    join latest_group_runs lgr on lgr.id = s.run_id
    where s.symbol not like '%SPARE%'
      and s.timeframe = $2
    order by s.symbol asc, s.ts desc
    limit $1
  `;

  const { rows } = await pool.query(sql, [limit, timeframe]);
  return rows as SignalRow[];
}
