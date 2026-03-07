import { getLatestSignals } from "db";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getLatestSignals(200);
  return Response.json({ ok: true, count: items.length, items });
}
