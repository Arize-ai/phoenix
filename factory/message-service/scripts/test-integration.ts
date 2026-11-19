import { runCommand } from "./command";
import { migrateDatabase } from "./migrate";
import { withTemporaryPostgres } from "./temporary-postgres";

await withTemporaryPostgres(async (databaseUrl) => {
  migrateDatabase(databaseUrl);
  runCommand({
    command: "vitest",
    args: ["run", "tests/database.integration.test.ts"],
    env: {
      ...process.env,
      TEST_DATABASE_URL: databaseUrl,
      DATABASE_URL: databaseUrl,
    },
  });
  runCommand({
    command: "dbmate",
    args: ["--no-dump-schema", "down"],
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  migrateDatabase(databaseUrl);
});
