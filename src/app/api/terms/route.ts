import type { NextRequest } from "next/server";
import { searchTerms } from "@/lib/terms";

// GET /api/terms?q=linear&category=pmbus
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  const results = searchTerms(q, category);
  return Response.json({ count: results.length, results });
}
