import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const orm = drizzle(pool);
type Rows = Record<string, unknown>[];
type Executor = { execute(query: SQL): Promise<Rows> };
// Drizzle's node-postgres driver returns QueryResult; expose its rows consistently
// for read and transactional writes without bypassing Drizzle's parameter binding.
export const db: Executor & { transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> } = {
  async execute(query) { return (await orm.execute(query)).rows; },
  transaction(fn) {
    return orm.transaction(async tx => fn({
      async execute(query) { return (await tx.execute(query)).rows; }
    }));
  }
};
export { pool };
