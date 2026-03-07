"use client";

import { useMemo, useState } from "react";

export type SignalRow = {
  symbol: string;
  timeframe: string;
  signal: string;
  price: number | string | null;
  signal_price: number | string | null;
  bars_ago: number | null;
  ts: string;
};

function tvChartUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function shortSymbol(tvSymbol: string): string {
  const i = tvSymbol.indexOf(":");
  return i > -1 ? tvSymbol.slice(i + 1) : tvSymbol;
}

function badgeClass(signal: string): string {
  const s = signal.toUpperCase();
  if (s === "BUY") return "badge buy";
  if (s === "SELL") return "badge sell";
  return "badge neutral";
}

export default function SignalsTable({ rows }: { rows: SignalRow[] }) {
  const [symbolFilter, setSymbolFilter] = useState("ALL");
  const [tvFilter, setTvFilter] = useState("ALL");
  const [timeframeFilter, setTimeframeFilter] = useState("ALL");
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [barsFilter, setBarsFilter] = useState("ALL");
  const [signalPriceOrder, setSignalPriceOrder] = useState("none");
  const [priceOrder, setPriceOrder] = useState("none");
  const [timeOrder, setTimeOrder] = useState("desc");

  const symbolOptions = useMemo(() => Array.from(new Set(rows.map((r) => shortSymbol(r.symbol)))).slice(0, 300), [rows]);
  const tvOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.symbol))).slice(0, 300), [rows]);
  const timeframeOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.timeframe))), [rows]);

  const filtered = useMemo(() => {
    let data = rows.filter((r) => {
      if (symbolFilter !== "ALL" && shortSymbol(r.symbol) !== symbolFilter) return false;
      if (tvFilter !== "ALL" && r.symbol !== tvFilter) return false;
      if (timeframeFilter !== "ALL" && r.timeframe !== timeframeFilter) return false;
      if (signalFilter !== "ALL" && r.signal !== signalFilter) return false;
      if (barsFilter === "0" && r.bars_ago !== 0) return false;
      if (barsFilter === "1-3" && (r.bars_ago == null || r.bars_ago < 1 || r.bars_ago > 3)) return false;
      if (barsFilter === "4+" && (r.bars_ago == null || r.bars_ago < 4)) return false;
      return true;
    });

    if (signalPriceOrder !== "none") {
      data = [...data].sort((a, b) => {
        const av = Number(a.signal_price ?? Number.NEGATIVE_INFINITY);
        const bv = Number(b.signal_price ?? Number.NEGATIVE_INFINITY);
        return signalPriceOrder === "asc" ? av - bv : bv - av;
      });
    }

    if (priceOrder !== "none") {
      data = [...data].sort((a, b) => {
        const av = Number(a.price ?? Number.NEGATIVE_INFINITY);
        const bv = Number(b.price ?? Number.NEGATIVE_INFINITY);
        return priceOrder === "asc" ? av - bv : bv - av;
      });
    }

    data = [...data].sort((a, b) => {
      const at = new Date(a.ts).getTime();
      const bt = new Date(b.ts).getTime();
      return timeOrder === "asc" ? at - bt : bt - at;
    });

    return data;
  }, [barsFilter, priceOrder, rows, signalFilter, signalPriceOrder, symbolFilter, timeframeFilter, timeOrder, tvFilter]);

  return (
    <section className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              Symbol
              <br />
              <select value={symbolFilter} onChange={(e) => setSymbolFilter(e.target.value)}>
                <option value="ALL">All</option>
                {symbolOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </th>
            <th>
              TV Symbol
              <br />
              <select value={tvFilter} onChange={(e) => setTvFilter(e.target.value)}>
                <option value="ALL">All</option>
                {tvOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </th>
            <th>
              Timeframe
              <br />
              <select value={timeframeFilter} onChange={(e) => setTimeframeFilter(e.target.value)}>
                <option value="ALL">All</option>
                {timeframeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </th>
            <th>
              Signal
              <br />
              <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)}>
                <option value="ALL">All</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </select>
            </th>
            <th>
              Candles Ago
              <br />
              <select value={barsFilter} onChange={(e) => setBarsFilter(e.target.value)}>
                <option value="ALL">All</option>
                <option value="0">0</option>
                <option value="1-3">1-3</option>
                <option value="4+">4+</option>
              </select>
            </th>
            <th>
              Signal Price
              <br />
              <select value={signalPriceOrder} onChange={(e) => setSignalPriceOrder(e.target.value)}>
                <option value="none">None</option>
                <option value="asc">Low-High</option>
                <option value="desc">High-Low</option>
              </select>
            </th>
            <th>
              Current Price
              <br />
              <select value={priceOrder} onChange={(e) => setPriceOrder(e.target.value)}>
                <option value="none">None</option>
                <option value="asc">Low-High</option>
                <option value="desc">High-Low</option>
              </select>
            </th>
            <th>
              At (UTC)
              <br />
              <select value={timeOrder} onChange={(e) => setTimeOrder(e.target.value)}>
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
            </th>
            <th>
              TV
              <br />
              <select value="open" disabled>
                <option>Link</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={`${s.symbol}-${s.timeframe}-${s.ts}`}>
              <td>{shortSymbol(s.symbol)}</td>
              <td>{s.symbol}</td>
              <td>{s.timeframe}</td>
              <td><span className={badgeClass(s.signal)}>{s.signal}</span></td>
              <td>{s.bars_ago ?? "-"}</td>
              <td>{s.signal_price ?? "-"}</td>
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
  );
}
