import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tickersPath = path.join(root, "config", "tickers.csv");
const groupsPath = path.join(root, "config", "groups.json");

const GROUP_COUNT = 50;
const TICKERS_PER_GROUP = 200;
const REQUIRED_TOTAL = GROUP_COUNT * TICKERS_PER_GROUP;

function toTvSymbol(input) {
  const s = input.trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) return s;
  if (s.endsWith("USDT")) return `BINANCE:${s}`;
  return `NASDAQ:${s}`;
}

const raw = fs.readFileSync(tickersPath, "utf8");
let symbols = raw
  .split(/\r?\n/)
  .map((x) => toTvSymbol(x))
  .filter(Boolean)
  .filter((x) => !x.startsWith("#"));

symbols = Array.from(new Set(symbols));

if (symbols.length < REQUIRED_TOTAL) {
  const missing = REQUIRED_TOTAL - symbols.length;
  for (let i = 1; i <= missing; i += 1) {
    symbols.push(`NASDAQ:SPARE${String(i).padStart(5, "0")}`);
  }
}

if (symbols.length > REQUIRED_TOTAL) {
  symbols = symbols.slice(0, REQUIRED_TOTAL);
}

const groups = [];
for (let i = 0; i < GROUP_COUNT; i += 1) {
  const start = i * TICKERS_PER_GROUP;
  const chunk = symbols.slice(start, start + TICKERS_PER_GROUP);
  groups.push({ groupId: i + 1, symbols: chunk });
}

fs.writeFileSync(tickersPath, `${symbols.join("\n")}\n`);
fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));

console.log(`Generated ${GROUP_COUNT} groups x ${TICKERS_PER_GROUP} = ${REQUIRED_TOTAL} tickers (TradingView format)`);
