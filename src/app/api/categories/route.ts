import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
export async function GET() {
  return NextResponse.json({ categories: await db.execute(sql`
    SELECT id,name,attribute_schema FROM category ORDER BY name`) });
}
