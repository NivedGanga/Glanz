import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe.skipIf(!process.env.RUN_DB_TESTS)("PostgreSQL integration", () => {
  let container: StartedTestContainer;
  let connection: string;
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
      .start();
    connection = `postgres://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/test`;
    const client = new Client({ connectionString: connection });
    await client.connect();
    for (const file of ["0001_run1.sql", "0002_marketplace.sql", "0003_digest.sql"])
      await client.query(readFileSync(resolve("src/db/migrations", file), "utf8"));
    await client.end();
  }, 120_000);
  afterAll(async () => { if (container) await container.stop(); });
  it("enables the trigram extension", async () => {
    const client = new Client({ connectionString: connection });
    await client.connect();
    expect((await client.query("SELECT similarity('dress','dres') AS score")).rows[0].score).toBeGreaterThan(0);
    await client.end();
  });
  it("allows only one concurrent rental for the same unit", async () => {
    const admin = new Client({ connectionString: connection });
    await admin.connect();
    const { rows: [district] } = await admin.query(
      "INSERT INTO district(name,country_code,timezone,currency) VALUES ('Test','+1','America/New_York','USD') RETURNING id");
    const { rows: [plan] } = await admin.query("INSERT INTO plan(name) VALUES ('test') RETURNING id");
    const { rows: [shop] } = await admin.query(
      "INSERT INTO shop(legal_name,email,district_id,phone,plan_id) VALUES ('Test','test@example.invalid',$1,'+12125550123',$2) RETURNING id",
      [district.id, plan.id]);
    const { rows: [branch] } = await admin.query(
      "INSERT INTO branch(shop_id,address) VALUES ($1,'Test address') RETURNING id", [shop.id]);
    const { rows: [category] } = await admin.query(
      "INSERT INTO category(name) VALUES ('Test category') RETURNING id");
    const { rows: [design] } = await admin.query(
      "INSERT INTO design(shop_id,category_id,name) VALUES ($1,$2,'Test design') RETURNING id",
      [shop.id, category.id]);
    const { rows: [unit] } = await admin.query(
      "INSERT INTO unit(design_id,branch_id,condition) VALUES ($1,$2,'good') RETURNING id",
      [design.id, branch.id]);
    const insert = async () => {
      const client = new Client({ connectionString: connection });
      await client.connect();
      try {
        await client.query(`INSERT INTO availability_block(unit_id,time_range,kind,created_by)
          VALUES ($1,tstzrange('2026-11-01T05:00:00Z','2026-11-02T05:00:00Z','[)'),'rental',$2)`,
        [unit.id, shop.id]);
        return true;
      } catch { return false; }
      finally { await client.end(); }
    };
    expect((await Promise.all([insert(), insert()])).filter(Boolean)).toHaveLength(1);
    await admin.end();
  }, 30_000);
});
