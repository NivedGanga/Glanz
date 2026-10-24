import PgBoss from "pg-boss";

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", error => console.error("worker error", error));
  await boss.start();
  await boss.createQueue("health");
  await boss.work("health", async () => { console.info("worker health job completed"); });
  if (process.env.WORKER_TEST_JOB === "1") await boss.send("health", {});
  const shutdown = async () => { await boss.stop(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
