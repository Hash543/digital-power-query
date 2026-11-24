import { getTerm } from "@/lib/terms";

// GET /api/terms/linear11
export async function GET(_req: Request, ctx: RouteContext<"/api/terms/[id]">) {
  const { id } = await ctx.params;
  const term = getTerm(id);
  return term ? Response.json(term) : Response.json({ error: `Term "${id}" not found` }, { status: 404 });
}
