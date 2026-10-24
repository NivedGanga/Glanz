import PgBoss from "pg-boss";
let boss: PgBoss | undefined;
export async function queueAnalysis(photoId: string) {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!);
    await boss.start();
    await boss.createQueue("photo-analysis");
  }
  await boss.send("photo-analysis", { photoId });
}
