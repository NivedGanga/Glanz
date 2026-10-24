import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY)");
    for (const file of readdirSync(resolve("src/db/migrations")).filter(f => f.endsWith(".sql")).sort()) {
      const name = file.replace(/\.sql$/, "");
      const existing = await client.query("SELECT 1 FROM schema_migration WHERE name = $1", [name]);
      if (!existing.rowCount) {
        await client.query(readFileSync(resolve("src/db/migrations", file), "utf8"));
        await client.query("INSERT INTO schema_migration(name) VALUES ($1)", [name]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
