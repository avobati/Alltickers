from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from ut_logic import aggregate_timeframe, fetch_yahoo_daily, ut_bot_alerts


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_STRATEGY = ROOT / "config" / "strategy.json"
DEFAULT_PROVIDER_MAP = ROOT / "config" / "provider_map.json"


def _state_from_tf(tf_data: dict) -> str:
    buy_recent = bool(tf_data.get("buy_recent", False))
    sell_recent = bool(tf_data.get("sell_recent", False))

    if not buy_recent and not sell_recent:
        return "NEUTRAL"
    if buy_recent and not sell_recent:
        return "BUY"
    if sell_recent and not buy_recent:
        return "SELL"

    bars_since_buy = tf_data.get("bars_since_buy")
    bars_since_sell = tf_data.get("bars_since_sell")

    if bars_since_buy is None and bars_since_sell is None:
        return "NEUTRAL"
    if bars_since_buy is None:
        return "SELL"
    if bars_since_sell is None:
        return "BUY"
    if bars_since_buy < bars_since_sell:
        return "BUY"
    if bars_since_sell < bars_since_buy:
        return "SELL"
    return "NEUTRAL"


def _normalize_symbol(symbol: str) -> str:
    text = symbol.strip().upper()
    if ":" in text:
        return text.split(":", 1)[1]
    return text


def _load_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def _default_provider_symbol(raw_symbol: str) -> str:
    if raw_symbol.endswith("USDT") and len(raw_symbol) > 4:
        return f"{raw_symbol[:-4]}-USD"
    return raw_symbol


def _provider_symbol(symbol: str, provider_map: dict[str, str]) -> str:
    return provider_map.get(symbol.upper(), _default_provider_symbol(symbol))


def _signal_metrics(signal: str, tf_data: dict) -> tuple[int | None, float | None]:
    if signal == "BUY":
        bars = tf_data.get("bars_since_buy")
        px = tf_data.get("last_buy_price")
        return bars, float(px) if px is not None else None
    if signal == "SELL":
        bars = tf_data.get("bars_since_sell")
        px = tf_data.get("last_sell_price")
        return bars, float(px) if px is not None else None

    b_buy = tf_data.get("bars_since_buy")
    b_sell = tf_data.get("bars_since_sell")
    if b_buy is None and b_sell is None:
        return None, None
    if b_buy is None:
        px = tf_data.get("last_sell_price")
        return b_sell, float(px) if px is not None else None
    if b_sell is None:
        px = tf_data.get("last_buy_price")
        return b_buy, float(px) if px is not None else None
    if b_buy <= b_sell:
        px = tf_data.get("last_buy_price")
        return b_buy, float(px) if px is not None else None
    px = tf_data.get("last_sell_price")
    return b_sell, float(px) if px is not None else None


def _main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframe", required=True, choices=["daily", "weekly", "monthly"])
    parser.add_argument("--strategy-path", default=str(DEFAULT_STRATEGY))
    parser.add_argument("--provider-map-path", default=str(DEFAULT_PROVIDER_MAP))
    args = parser.parse_args()

    strategy = _load_json(Path(args.strategy_path), {
        "key_value": 2,
        "atr_period": 6,
        "lookback_candles": {"daily": 180, "weekly": 24, "monthly": 6},
    })
    provider_map = _load_json(Path(args.provider_map_path), {})

    key_value = float(strategy.get("key_value", 2))
    atr_period = int(strategy.get("atr_period", 6))
    lookbacks = strategy.get("lookback_candles", {"daily": 180, "weekly": 24, "monthly": 6})
    lookback = int(lookbacks.get(args.timeframe, 3))

    norm_symbol = _normalize_symbol(args.symbol)
    provider_symbol = _provider_symbol(norm_symbol, provider_map)

    raw = fetch_yahoo_daily(provider_symbol, range_name="10y")
    candles = raw if args.timeframe == "daily" else aggregate_timeframe(raw, args.timeframe)

    tf_data = ut_bot_alerts(candles, key_value, atr_period, lookback)
    signal = _state_from_tf(tf_data)
    bars_ago, signal_price = _signal_metrics(signal, tf_data)

    close_price = float(tf_data.get("close", 0.0)) if tf_data.get("close") is not None else None
    if bars_ago is None:
      bars_ago = 0
    if signal_price is None:
      signal_price = close_price

    out = {
        "signal": signal,
        "price": close_price,
        "signal_price": signal_price,
        "bars_ago": bars_ago,
        "ts": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "provider_symbol": provider_symbol,
            "timeframe": args.timeframe,
            "source": "embedded-ut-logic",
        },
    }
    print(json.dumps(out))


if __name__ == "__main__":
    _main()
