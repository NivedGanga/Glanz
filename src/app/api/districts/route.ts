import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
export async function GET() {
  const districts = await db.execute(sql`SELECT id,name,country_code,currency,timezone
    FROM district WHERE launch_state IN ('demo','live') ORDER BY name`);
  return NextResponse.json({ districts });
}
