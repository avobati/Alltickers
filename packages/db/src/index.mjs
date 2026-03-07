import pg from "pg";

const { Pool } = pg;
const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
const allowNoDb = process.env.ALLOW_NO_DB === "1";
const hasPlaceholderDbUrl = /user:pass@host/.test(rawDatabaseUrl);
const useNoDbMode = allowNoDb || !rawDatabaseUrl || hasPlaceholderDbUrl;

let pool = null;
if (!useNoDbMode) {
  pool = new Pool({ connectionString: rawDatabaseUrl });
}

async function query(sql, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured for live writes");
  }
  return pool.query(sql, params);
}

export async function beginRun(groupId, timeframe) {
  if (useNoDbMode) {
    return { id: Date.now(), started_at: new Date().toISOString() };
  }

  const sql = `
    insert into scan_runs(group_id, timeframe, status)
    values ($1, $2, 'running')
    returning id, started_at
  `;
  const { rows } = await query(sql, [groupId, timeframe]);
  return rows[0];
}

export async function finishRun(runId, status, error) {
  if (useNoDbMode) {
    return;
  }

  const sql = `
    update scan_runs
    set status = $2, error = $3, finished_at = now()
    where id = $1
  `;
  await query(sql, [runId, status, error]);
}

export async function upsertSignal({ symbol, timeframe, signal, price, ts, runId }) {
  if (useNoDbMode) {
    return;
  }

  const sql = `
    insert into signals(symbol, timeframe, signal, price, ts, run_id)
    values ($1, $2, $3, $4, $5, $6)
    on conflict (symbol, timeframe, ts)
    do update set signal = excluded.signal, price = excluded.price, run_id = excluded.run_id
  `;
  await query(sql, [symbol, timeframe, signal, price, ts, runId]);
}

export async function getLatestSignals(limit = 100) {
  if (useNoDbMode) {
    return [];
  }

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
  const { rows } = await query(sql, [limit]);
  return rows;
}
