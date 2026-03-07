import { getLatestSignals } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "weekly";
  const items = await getLatestSignals(400, timeframe);
  return Response.json({ ok: true, timeframe, count: items.length, items });
}
