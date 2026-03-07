export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    app: "alltickers-web",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
    url: process.env.VERCEL_URL || "unknown",
    ts: new Date().toISOString()
  });
}
