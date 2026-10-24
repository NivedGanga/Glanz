import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { guarded } from "../../../lib/http";
import { requireSession } from "../../../lib/auth";
import { recordEvent } from "../../../lib/events";

export async function GET(req: NextRequest) {
  return guarded("customer.accounts", async () => {
    const type = req.nextUrl.searchParams.get("type") === "shop" ? "shop" : "customer";
    const id = await requireSession(type);
    if (type === "shop") {
      const rows = await db.execute(sql`SELECT s.id,s.legal_name,s.email,s.phone,s.opening_hours,
        b.address FROM shop s JOIN shop_user u ON u.shop_id=s.id
        LEFT JOIN branch b ON b.shop_id=s.id WHERE u.user_id=${id}::uuid`);
      await recordEvent(id, "shop.exported", id);
      return NextResponse.json({ shops: rows });
    }
    const customers = await db.execute(sql`SELECT id,phone,name,district_id FROM customer WHERE id=${id}::uuid`);
    const requests = await db.execute(sql`SELECT id,event_start,return_end,description,group_size,status
      FROM request WHERE customer_id=${id}::uuid`);
    const consents = await db.execute(sql`SELECT purpose,version,granted_at,withdrawn_at
      FROM consent WHERE subject_type='customer' AND subject_id=${id}::uuid`);
    await recordEvent(id, "customer.exported", id);
    return NextResponse.json({ customers, requests, consents });
  });
}
export async function DELETE() {
  return guarded("customer.accounts", async () => {
    const id = await requireSession("customer");
    // Preserve aggregate event history without personal text or contact information.
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE customer SET name='Deleted',phone=${`+999${BigInt(`0x${id.replaceAll("-", "")}`).toString().slice(0, 11)}`}
        WHERE id=${id}::uuid`);
      await tx.execute(sql`UPDATE request SET description='',answers='{}'
        WHERE customer_id=${id}::uuid`);
      await tx.execute(sql`DELETE FROM request_answer WHERE request_id IN
        (SELECT id FROM request WHERE customer_id=${id}::uuid)`);
      await tx.execute(sql`UPDATE photo SET status='deletion_pending' WHERE owner_type='request'
        AND owner_id IN (SELECT id FROM request WHERE customer_id=${id}::uuid)`);
      await tx.execute(sql`UPDATE consent SET withdrawn_at=now() WHERE subject_type='customer'
        AND subject_id=${id}::uuid AND withdrawn_at IS NULL`);
      await tx.execute(sql`DELETE FROM auth_session WHERE subject_type='customer' AND subject_id=${id}::uuid`);
    });
    await recordEvent("system", "customer.deleted", id);
    return NextResponse.json({ ok: true, mediaDeletionPending: true });
  });
}
