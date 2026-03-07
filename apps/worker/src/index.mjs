import fs from "node:fs";
import path from "node:path";
import { runUtScan } from "core";
import { beginRun, finishRun, upsertSignal } from "db";

const root = path.resolve(process.cwd(), "../..");
const groupsPath = path.join(root, "config", "groups.json");

function getArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const groupId = Number(getArg("group", "1"));
const timeframe = process.env.SCAN_TIMEFRAME || "daily";

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const selected = groups.find((g) => g.groupId === groupId);

if (!selected) {
  throw new Error(`Group ${groupId} not found in config/groups.json`);
}

const run = await beginRun(groupId, timeframe);

try {
  for (const symbol of selected.symbols) {
    const res = await runUtScan({ symbol, timeframe });
    await upsertSignal({
      symbol,
      timeframe,
      signal: res.signal,
      price: res.price,
      ts: res.ts,
      runId: run.id
    });
  }

  await finishRun(run.id, "success", null);
  console.log(`Group ${groupId} completed: ${selected.symbols.length} symbols`);
} catch (error) {
  await finishRun(run.id, "failed", String(error));
  throw error;
}
