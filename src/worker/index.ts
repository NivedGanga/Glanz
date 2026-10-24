import PgBoss from "pg-boss";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import { GeminiTagger, type PhotoTagger } from "../lib/photo-analysis";
import { signedPhotoUrl } from "../lib/media";
import { sendDigests } from "../lib/digest";
import { config } from "../lib/config";

export async function markIgnored() {
  const stale = await db.execute(sql`SELECT rs.request_id,rs.shop_id,r.reasons,r.flag_snapshot
    FROM request_shop rs JOIN request req ON req.id=rs.request_id
    JOIN recommendation r ON r.request_id=rs.request_id AND r.shop_id=rs.shop_id
      AND r.shown_at IS NOT NULL
    WHERE rs.status='sent' AND req.event_start>now()
      AND r.shown_at < now()-(${config.ignoredAfterHours}::int*interval '1 hour')`);
  for (const item of stale) await db.transaction(async tx => {
    const [changed] = await tx.execute(sql`UPDATE request_shop SET status='ignored',responded_at=now()
      WHERE request_id=${item.request_id}::uuid AND shop_id=${item.shop_id}::uuid
        AND status='sent' RETURNING request_id`);
    if (changed) await tx.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot)
      VALUES ('system','recommendation.ignored',${item.shop_id},
        ${JSON.stringify({ requestId: item.request_id, reasons: item.reasons })}::jsonb,
        ${JSON.stringify(item.flag_snapshot)}::jsonb)`);
  });
}

export async function analysePhoto(photoId: string, tagger: PhotoTagger) {
  const [row] = await db.execute(sql`SELECT p.id,p.owner_id,p.owner_type,p.storage_key,p.is_synthetic,
    a.id AS analysis_id,a.purpose,a.consent_id,a.model_version,a.status,
    c.attribute_schema FROM photo p JOIN photo_analysis a ON a.photo_id=p.id
    LEFT JOIN design d ON p.owner_type='design' AND d.id=p.owner_id
    LEFT JOIN request r ON p.owner_type='request' AND r.id=p.owner_id
    JOIN category c ON c.id=COALESCE(d.category_id,r.category_id)
    WHERE p.id=${photoId}::uuid`);
  if (!row || row.status !== "pending") return;
  try {
    if (row.purpose === "customer_request") {
      const [consent] = await db.execute(sql`SELECT id FROM consent
        WHERE id=${row.consent_id}::uuid AND purpose='ai_photo_tagging' AND withdrawn_at IS NULL`);
      if (!consent) {
        await db.execute(sql`UPDATE photo_analysis SET status='skipped',completed_at=now()
          WHERE id=${row.analysis_id}::uuid`);
        return;
      }
    }
    const response = await fetch(await signedPhotoUrl(String(row.storage_key)));
    if (!response.ok) throw new Error("MEDIA_FETCH_FAILED");
    const tags = await tagger.analyse({
      bytes: new Uint8Array(await response.arrayBuffer()), isSynthetic: row.is_synthetic === true
    }, row.attribute_schema as Record<string, string[]>);
    await db.transaction(async tx => {
      for (const tag of tags) await tx.execute(sql`INSERT INTO tag(entity_type,entity_id,field,value,source,status,model_version)
        VALUES (${row.owner_type},${row.owner_id}::uuid,${tag.field},${tag.value},'ai','suggested',${row.model_version})`);
      await tx.execute(sql`UPDATE photo_analysis SET status='done',attempts=attempts+1,completed_at=now()
        WHERE id=${row.analysis_id}::uuid`);
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ANALYSIS_FAILED";
    await db.execute(sql`UPDATE photo_analysis SET status='failed',attempts=attempts+1,
      error_code=${code},completed_at=now() WHERE id=${row.analysis_id}::uuid`);
  }
}

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", error => console.error("worker error", error));
  await boss.start();
  await boss.createQueue("health");
  await boss.createQueue("photo-analysis");
  await boss.work("health", async () => { console.info("worker health job completed"); });
  await boss.work("photo-analysis", async jobs => {
    const tier = process.env.GEMINI_TIER === "prod" ? "prod" : "dev";
    const tagger = new GeminiTagger(tier, tier === "prod" ?
      process.env.GEMINI_API_KEY_PROD ?? "" : process.env.GEMINI_API_KEY_DEV ?? "");
    for (const job of jobs) await analysePhoto(String((job.data as { photoId: string }).photoId), tagger);
  });
  if (process.env.WORKER_TEST_JOB === "1") await boss.send("health", {});
  const digestTimer = setInterval(() => {
    sendDigests().catch(error => console.error("digest error", error));
    markIgnored().catch(error => console.error("ignored outcome error", error));
  }, 60_000);
  const shutdown = async () => { clearInterval(digestTimer); await boss.stop(); await pool.end(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
