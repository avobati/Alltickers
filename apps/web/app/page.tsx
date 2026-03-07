import { getLatestSignals } from "../lib/db";
import SignalsTable from "./components/signals-table";

export const dynamic = "force-dynamic";

type Signal = {
  symbol: string;
  timeframe: string;
  signal: string;
  price: number | string | null;
  signal_price: number | string | null;
  bars_ago: number | null;
  ts: string;
};

export default async function Home() {
  const signals = (await getLatestSignals(10000, "weekly")) as Signal[];
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || "local";

  const buyCount = signals.filter((s) => s.signal === "BUY").length;
  const sellCount = signals.filter((s) => s.signal === "SELL").length;
  const neutralCount = signals.length - buyCount - sellCount;

  return (
    <main className="container">
      <section className="hero">
        <div>
          <h1 className="title">AllTickers UT Scanner</h1>
          <p className="sub">Weekly signals, 50 groups x 200 tickers, TradingView-linked output.</p>
        </div>
        <div className="meta">Build {commit.slice(0, 7)}</div>
      </section>

      <section className="kpis">
        <div className="kpi">
          <div className="label">Rows Shown</div>
          <div className="value">{signals.length}</div>
        </div>
        <div className="kpi">
          <div className="label">BUY</div>
          <div className="value" style={{ color: "var(--buy)" }}>{buyCount}</div>
        </div>
        <div className="kpi">
          <div className="label">SELL</div>
          <div className="value" style={{ color: "var(--sell)" }}>{sellCount}</div>
        </div>
        <div className="kpi">
          <div className="label">NEUTRAL</div>
          <div className="value" style={{ color: "var(--neutral)" }}>{neutralCount}</div>
        </div>
      </section>

      <SignalsTable rows={signals} />
    </main>
  );
}
