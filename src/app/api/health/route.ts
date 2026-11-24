// GET /api/health – used by the deploy script to confirm the new release is serving.
// APP_COMMIT is set by CI at build time, so the response identifies the deployed commit.
export function GET() {
  return Response.json({ status: "ok", commit: process.env.APP_COMMIT ?? "dev" });
}
