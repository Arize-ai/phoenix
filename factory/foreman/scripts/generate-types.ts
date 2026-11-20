import { runCommand } from "./command";
import { migrateDatabase } from "./migrate";
import { withTemporaryPostgres } from "./temporary-postgres";

await withTemporaryPostgres(async (databaseUrl): Promise<void> => {
  migrateDatabase(databaseUrl);
  runCommand({
    command: "kysely-codegen",
    args: [
      "--dialect",
      "postgres",
      "--default-schema",
      "public",
      "--exclude-pattern",
      "schema_migrations",
      "--out-file",
      "src/db/generated.ts",
    ],
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
});
