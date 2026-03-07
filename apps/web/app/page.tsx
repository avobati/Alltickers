import { getLatestSignals } from "db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const signals = await getLatestSignals(100);

  return (
    <main style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24 }}>
      <h1>UT Scanner V2</h1>
      <p>50 groups, daily scan, TradingView-formatted symbols.</p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Symbol</th>
            <th align="left">Timeframe</th>
            <th align="left">Signal</th>
            <th align="left">Price</th>
            <th align="left">At (UTC)</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={`${s.symbol}-${s.timeframe}-${s.ts}`}>
              <td>{s.symbol}</td>
              <td>{s.timeframe}</td>
              <td>{s.signal}</td>
              <td>{s.price ?? "-"}</td>
              <td>{new Date(s.ts).toISOString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
