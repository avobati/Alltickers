create table if not exists scan_runs (
  id bigserial primary key,
  group_id integer not null,
  timeframe text not null,
  status text not null,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists signals (
  id bigserial primary key,
  symbol text not null,
  timeframe text not null,
  signal text not null check (signal in ('BUY', 'SELL', 'NEUTRAL')),
  price numeric,
  ts timestamptz not null,
  run_id bigint references scan_runs(id),
  created_at timestamptz not null default now(),
  unique(symbol, timeframe, ts)
);

create index if not exists idx_signals_symbol_tf_ts on signals(symbol, timeframe, ts desc);
