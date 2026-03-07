import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tickersPath = path.join(root, "config", "tickers.csv");
const groupsPath = path.join(root, "config", "groups.json");

const raw = fs.readFileSync(tickersPath, "utf8");
const symbols = raw
  .split(/\r?\n/)
  .map((x) => x.trim())
  .filter(Boolean)
  .filter((x) => !x.startsWith("#"));

const groupCount = 50;
const perGroup = Math.ceil(symbols.length / groupCount);
const groups = [];

for (let i = 0; i < groupCount; i += 1) {
  const start = i * perGroup;
  const chunk = symbols.slice(start, start + perGroup);
  groups.push({ groupId: i + 1, symbols: chunk });
}

fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
console.log(`Generated ${groupCount} groups from ${symbols.length} symbols`);
