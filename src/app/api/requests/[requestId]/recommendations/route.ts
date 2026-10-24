import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireSession } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { computeRecommendations } from "../../../../../lib/recommendations";

export async function GET(_: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  return guarded("reco.v1", async () => {
    const { requestId } = await context.params;
    const customer = await requireSession("customer");
    const [owned] = await db.execute(sql`SELECT 1 FROM request
      WHERE id=${requestId}::uuid AND customer_id=${customer}::uuid AND status='draft'`);
    if (!owned) throw new Error("REQUEST_NOT_FOUND");
    const results = await computeRecommendations(requestId);
    const shops = await db.execute(sql`SELECT s.id,s.legal_name,s.phone
      FROM shop s JOIN recommendation r ON r.shop_id=s.id
      WHERE r.request_id=${requestId}::uuid AND r.shown_at IS NOT NULL ORDER BY r.rank`);
    return NextResponse.json({ ...results, shops, message: results.shown.length ? null : "No close matches" });
  });
}
