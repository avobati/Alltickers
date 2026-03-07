import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function beginRun(groupId, timeframe) {
  const sql = `
    insert into scan_runs(group_id, timeframe, status)
    values ($1, $2, 'running')
    returning id, started_at
  `;
  const { rows } = await pool.query(sql, [groupId, timeframe]);
  return rows[0];
}

export async function finishRun(runId, status, error) {
  const sql = `
    update scan_runs
    set status = $2, error = $3, finished_at = now()
    where id = $1
  `;
  await pool.query(sql, [runId, status, error]);
}

export async function upsertSignal({ symbol, timeframe, signal, price, ts, runId }) {
  const sql = `
    insert into signals(symbol, timeframe, signal, price, ts, run_id)
    values ($1, $2, $3, $4, $5, $6)
    on conflict (symbol, timeframe, ts)
    do update set signal = excluded.signal, price = excluded.price, run_id = excluded.run_id
  `;
  await pool.query(sql, [symbol, timeframe, signal, price, ts, runId]);
}

export async function getLatestSignals(limit = 100) {
  const sql = `
    select s.symbol, s.timeframe, s.signal, s.price, s.ts
    from signals s
    join (
      select symbol, timeframe, max(ts) as max_ts
      from signals
      group by symbol, timeframe
    ) latest
      on s.symbol = latest.symbol
     and s.timeframe = latest.timeframe
     and s.ts = latest.max_ts
    order by s.ts desc
    limit $1
  `;
  const { rows } = await pool.query(sql, [limit]);
  return rows;
}
