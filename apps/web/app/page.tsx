import { getLatestSignals } from "../lib/db";

export const dynamic = "force-dynamic";

type Signal = {
  symbol: string;
  timeframe: string;
  signal: string;
  price: number | string | null;
  ts: string;
};

function tvChartUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function badgeClass(signal: string): string {
  const s = signal.toUpperCase();
  if (s === "BUY") return "badge buy";
  if (s === "SELL") return "badge sell";
  return "badge neutral";
}

export default async function Home() {
  const signals = (await getLatestSignals(200)) as Signal[];
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || "local";

  const buyCount = signals.filter((s) => s.signal === "BUY").length;
  const sellCount = signals.filter((s) => s.signal === "SELL").length;
  const neutralCount = signals.length - buyCount - sellCount;

  return (
    <main className="container">
      <section className="hero">
        <div>
          <h1 className="title">AllTickers UT Scanner</h1>
          <p className="sub">TradingView symbols, 50 groups x 200 tickers, daily batch engine.</p>
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

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Timeframe</th>
              <th>Signal</th>
              <th>Price</th>
              <th>At (UTC)</th>
              <th>TV</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={`${s.symbol}-${s.timeframe}-${s.ts}`}>
                <td>{s.symbol}</td>
                <td>{s.timeframe}</td>
                <td><span className={badgeClass(s.signal)}>{s.signal}</span></td>
                <td>{s.price ?? "-"}</td>
                <td>{new Date(s.ts).toISOString()}</td>
                <td>
                  <a className="tv-link" href={tvChartUrl(s.symbol)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
