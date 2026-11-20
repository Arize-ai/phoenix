import { runCommand } from "./command";

import "./environment";

export function migrateDatabase(databaseUrl: string): void {
  runCommand({
    command: "dbmate",
    args: ["--no-dump-schema", "--migration-lock", "migrate"],
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

if (process.argv[1]?.endsWith("/migrate.ts")) {
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL before migrating.");
  migrateDatabase(databaseUrl);
}
