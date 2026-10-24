import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";

const input = z.object({ unitId: z.string().uuid(), start: z.string().datetime(),
  end: z.string().datetime(), kind: z.enum(["rental","maintenance","alteration","buffer"]) });
export async function POST(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("availability.blocks", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = input.parse(await req.json());
    if (new Date(body.start) >= new Date(body.end)) throw new Error("INVALID_WINDOW");
    const id = await db.transaction(async tx => {
      // Lock the unit before the overlap check; the GiST exclusion constraint is a second guard.
      const [unit] = await tx.execute(sql`SELECT u.id,COALESCE(s.buffer_override_days,c.default_buffer_days) AS days
        FROM unit u JOIN design d ON d.id=u.design_id JOIN category c ON c.id=d.category_id
        JOIN shop s ON s.id=d.shop_id WHERE u.id=${body.unitId}::uuid AND s.id=${shopId}::uuid
        FOR UPDATE OF u`);
      if (!unit) throw new Error("UNIT_NOT_FOUND");
      const [conflict] = await tx.execute(sql`SELECT id FROM availability_block
        WHERE unit_id=${body.unitId}::uuid AND time_range &&
          tstzrange(${body.start}::timestamptz - (${unit.days}::int * interval '1 day'),
            ${body.end}::timestamptz + (${unit.days}::int * interval '1 day'),'[)') LIMIT 1`);
      if (conflict) throw new Error("UNAVAILABLE_WITH_BUFFER");
      const [block] = await tx.execute(sql`INSERT INTO availability_block(unit_id,time_range,kind,created_by)
        VALUES (${body.unitId}::uuid,tstzrange(${body.start}::timestamptz,${body.end}::timestamptz,'[)'),
          ${body.kind},${actor}::uuid) RETURNING id`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload) VALUES
        (${actor},'availability.changed',${block.id},
        ${JSON.stringify({ unitId: body.unitId, kind: body.kind, start: body.start, end: body.end })}::jsonb)`);
      return block.id;
    });
    return NextResponse.json({ id }, { status: 201 });
  });
}
