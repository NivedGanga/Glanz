import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { digest } from "../../../lib/auth";
import { guarded } from "../../../lib/http";

export async function GET(req: NextRequest) {
  return guarded("shop.catalog_link", async () => {
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token.length < 32) throw new Error("INVALID_TOKEN");
    const rows = await db.execute(sql`SELECT s.legal_name,s.phone,d.id,d.name,d.description,
      c.name AS category,r.period_type,r.price_paise,r.currency FROM shop s
      JOIN design d ON d.shop_id=s.id JOIN category c ON c.id=d.category_id
      LEFT JOIN rate_card r ON r.design_id=d.id WHERE s.catalog_token_hash=${digest(token)}`);
    return NextResponse.json({ designs: rows });
  });
}
