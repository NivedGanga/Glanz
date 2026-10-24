import PgBoss from "pg-boss";
export async function queueAnalysis(photoId: string) {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  try {
    await boss.start();
    await boss.createQueue("photo-analysis");
    await boss.send("photo-analysis", { photoId });
  } finally {
    await boss.stop();
  }
}
