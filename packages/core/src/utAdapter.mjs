import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bridgePath = path.resolve(__dirname, "../../../apps/worker/src/ut_bridge.py");

export async function runUtScan({ symbol, timeframe }) {
  const pythonBin = process.env.PYTHON_BIN || "python";

  try {
    const { stdout } = await execFileAsync(
      pythonBin,
      [bridgePath, "--symbol", symbol, "--timeframe", timeframe],
      {
        env: process.env,
        maxBuffer: 1024 * 1024,
      }
    );

    const parsed = JSON.parse(stdout.trim());
    return {
      signal: parsed.signal,
      price: parsed.price,
      ts: parsed.ts,
      meta: parsed.meta || {},
    };
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : String(error);
    throw new Error(`UT bridge failed for ${symbol}/${timeframe}: ${stderr}`);
  }
}
