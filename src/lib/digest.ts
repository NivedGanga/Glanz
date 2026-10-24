import { sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "./config";
import { email } from "./adapters";
import { flags } from "./flags";

export function inQuietHours(now: Date, timezone: string, start: string, end: string) {
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit",
    minute: "2-digit", hourCycle: "h23" }).format(now);
  return start < end ? local >= start && local < end : local >= start || local < end;
}
export function capAllows(daily: number, monthly: number, dailyCap: number, monthlyCap: number) {
  return daily < dailyCap && monthly < monthlyCap;
}
export async function sendDigests(now = new Date()) {
  if (!await flags.enabled("notifications.digest")) return;
  const shops = await db.execute(sql`SELECT s.id,s.email,s.legal_name,d.timezone,ss.notification_daily_cap,
    ss.quiet_hours,ss.digest_interval_hours FROM shop s JOIN shop_settings ss ON ss.shop_id=s.id
    JOIN district d ON d.id=s.district_id WHERE s.listing_status='published'`);
  for (const shop of shops) {
    const quiet = shop.quiet_hours as { start: string; end: string };
    if (inQuietHours(now, String(shop.timezone), quiet.start, quiet.end)) continue;
    const [recent] = await db.execute(sql`SELECT 1 FROM notification WHERE shop_id=${shop.id}::uuid
      AND status='sent' AND template='request_digest'
      AND sent_at>${now}::timestamptz-(${shop.digest_interval_hours}::int*interval '1 hour') LIMIT 1`);
    if (recent) continue;
    const pending = await db.execute(sql`SELECT rs.request_id FROM request_shop rs
      WHERE rs.shop_id=${shop.id}::uuid AND NOT EXISTS (
        SELECT 1 FROM notification_request nr JOIN notification n ON n.id=nr.notification_id
        WHERE nr.request_id=rs.request_id AND n.shop_id=rs.shop_id AND n.status='sent')
      ORDER BY rs.request_id LIMIT 100`);
    if (!pending.length) continue;
    const [counts] = await db.execute(sql`SELECT
      (SELECT count(*) FROM notification n WHERE n.shop_id=${shop.id}::uuid AND n.status='sent'
        AND n.sent_at>=date_trunc('day',${now}::timestamptz AT TIME ZONE ${shop.timezone})
          AT TIME ZONE ${shop.timezone}) AS daily,
      (SELECT count(*) FROM notification_request nr JOIN notification n ON n.id=nr.notification_id
        WHERE n.shop_id=${shop.id}::uuid AND n.status='sent'
        AND n.sent_at>=date_trunc('month',${now}::timestamptz AT TIME ZONE ${shop.timezone})
          AT TIME ZONE ${shop.timezone}) AS monthly`);
    if (!capAllows(Number(counts.daily), Number(counts.monthly),
      Math.min(Number(shop.notification_daily_cap), config.dailyNotifications), config.monthlyNotifications)) continue;
    const batch = pending.slice(0, config.monthlyNotifications - Number(counts.monthly));
    const [notification] = await db.execute(sql`INSERT INTO notification(recipient,shop_id,channel,template,status)
      VALUES (${shop.email},${shop.id}::uuid,'email','request_digest','pending') RETURNING id`);
    try {
      await email.send(String(shop.email), "request_digest",
        `${batch.length} selected request(s) are waiting in your inbox.`);
      await db.transaction(async tx => {
        await tx.execute(sql`UPDATE notification SET status='sent',sent_at=${now}
          WHERE id=${notification.id}::uuid`);
        for (const row of batch) await tx.execute(sql`INSERT INTO notification_request(notification_id,request_id)
          VALUES (${notification.id}::uuid,${row.request_id}::uuid)`);
        await tx.execute(sql`INSERT INTO event(actor,type,subject,payload)
          VALUES ('system','digest.sent',${shop.id},${JSON.stringify({ count: batch.length })}::jsonb)`);
      });
    } catch {
      await db.execute(sql`UPDATE notification SET status='failed',error_code='EMAIL_FAILURE'
        WHERE id=${notification.id}::uuid`);
    }
  }
}
