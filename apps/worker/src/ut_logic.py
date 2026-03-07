from __future__ import annotations

import json
import random
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List


@dataclass
class Candle:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


def _dt_from_unix(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def fetch_yahoo_daily(provider_symbol: str, range_name: str = "10y", retries: int = 1) -> List[Candle]:
    encoded = urllib.parse.quote(provider_symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1d&range={range_name}"

    payload = None
    last_err: Exception | None = None

    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempt < retries - 1:
                time.sleep(0.25 + random.uniform(0.05, 0.2))

    if payload is None:
        if last_err:
            raise last_err
        return []

    result = payload.get("chart", {}).get("result")
    if not result:
        return []

    data = result[0]
    timestamps = data.get("timestamp", [])
    quote = data.get("indicators", {}).get("quote", [{}])[0]

    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote.get("close", [])
    volumes = quote.get("volume", [])

    candles: List[Candle] = []
    for i, ts in enumerate(timestamps):
        try:
            o = opens[i]
            h = highs[i]
            l = lows[i]
            c = closes[i]
            v = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
            if None in {o, h, l, c}:
                continue
            candles.append(
                Candle(
                    timestamp=_dt_from_unix(int(ts)),
                    open=float(o),
                    high=float(h),
                    low=float(l),
                    close=float(c),
                    volume=float(v),
                )
            )
        except (IndexError, TypeError, ValueError):
            continue

    candles.sort(key=lambda c: c.timestamp)
    return candles


def aggregate_timeframe(candles: List[Candle], timeframe: str) -> List[Candle]:
    if timeframe == "daily":
        return candles

    bucketed = {}
    for candle in candles:
        dt = datetime.strptime(candle.timestamp, "%Y-%m-%d")
        if timeframe == "weekly":
            year, week, _ = dt.isocalendar()
            bucket = f"{year}-W{week:02d}"
        elif timeframe == "monthly":
            bucket = dt.strftime("%Y-%m")
        else:
            raise ValueError(f"Unsupported timeframe '{timeframe}'")
        bucketed.setdefault(bucket, []).append(candle)

    aggregated: List[Candle] = []
    for _, values in sorted(bucketed.items(), key=lambda x: x[0]):
        first = values[0]
        last = values[-1]
        aggregated.append(
            Candle(
                timestamp=last.timestamp,
                open=first.open,
                high=max(v.high for v in values),
                low=min(v.low for v in values),
                close=last.close,
                volume=sum(v.volume for v in values),
            )
        )
    return aggregated


def _true_range(current: Candle, prev_close: float) -> float:
    return max(
        current.high - current.low,
        abs(current.high - prev_close),
        abs(current.low - prev_close),
    )


def atr(candles: List[Candle], period: int) -> List[float]:
    if len(candles) < 2:
        return [0.0 for _ in candles]

    tr_values: List[float] = [0.0]
    for i in range(1, len(candles)):
        tr_values.append(_true_range(candles[i], candles[i - 1].close))

    atr_values: List[float] = [0.0 for _ in candles]
    if len(candles) <= period:
        return atr_values

    seed = sum(tr_values[1 : period + 1]) / period
    atr_values[period] = seed

    for i in range(period + 1, len(candles)):
        atr_values[i] = ((atr_values[i - 1] * (period - 1)) + tr_values[i]) / period

    return atr_values


def _last_true_index(values: List[bool]) -> int | None:
    for i in range(len(values) - 1, -1, -1):
        if values[i]:
            return i
    return None


def ut_bot_alerts(candles: List[Candle], key_value: float, atr_period: int, lookback: int):
    if len(candles) < atr_period + 3:
        return {
            "buy_signal": False,
            "sell_signal": False,
            "buy_recent": False,
            "sell_recent": False,
            "bars_since_buy": None,
            "bars_since_sell": None,
            "last_buy_price": None,
            "last_sell_price": None,
            "atr": 0.0,
            "trailing_stop": 0.0,
            "close": candles[-1].close if candles else 0.0,
            "lookback": lookback,
        }

    closes = [c.close for c in candles]
    atr_values = atr(candles, atr_period)
    trails: List[float] = [closes[0]]

    for i in range(1, len(candles)):
        n_loss = key_value * atr_values[i]
        prev_trail = trails[-1]
        prev_close = closes[i - 1]
        close = closes[i]

        if close > prev_trail and prev_close > prev_trail:
            next_trail = max(prev_trail, close - n_loss)
        elif close < prev_trail and prev_close < prev_trail:
            next_trail = min(prev_trail, close + n_loss)
        elif close > prev_trail:
            next_trail = close - n_loss
        else:
            next_trail = close + n_loss

        trails.append(next_trail)

    buy_flags = [False for _ in closes]
    sell_flags = [False for _ in closes]

    for i in range(1, len(closes)):
        buy_flags[i] = closes[i] > trails[i] and closes[i - 1] <= trails[i - 1]
        sell_flags[i] = closes[i] < trails[i] and closes[i - 1] >= trails[i - 1]

    last_buy_idx = _last_true_index(buy_flags)
    last_sell_idx = _last_true_index(sell_flags)

    bars_since_buy = None if last_buy_idx is None else (len(closes) - 1 - last_buy_idx)
    bars_since_sell = None if last_sell_idx is None else (len(closes) - 1 - last_sell_idx)

    last_buy_price = None if last_buy_idx is None else closes[last_buy_idx]
    last_sell_price = None if last_sell_idx is None else closes[last_sell_idx]

    buy_recent = bars_since_buy is not None and bars_since_buy < lookback
    sell_recent = bars_since_sell is not None and bars_since_sell < lookback

    return {
        "buy_signal": buy_flags[-1],
        "sell_signal": sell_flags[-1],
        "buy_recent": buy_recent,
        "sell_recent": sell_recent,
        "bars_since_buy": bars_since_buy,
        "bars_since_sell": bars_since_sell,
        "last_buy_price": last_buy_price,
        "last_sell_price": last_sell_price,
        "atr": atr_values[-1],
        "trailing_stop": trails[-1],
        "close": closes[-1],
        "lookback": lookback,
    }
