import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "./generated";

let database: Kysely<DB> | undefined;

export function getDatabase(): Kysely<DB> {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  database = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, max: 5 }),
    }),
  });
  return database;
}
