import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Keep this default in sync with DB_FILE_NAME in src/config.ts so the migrate
// CLI and the server target the same database file.
const dbFile =
  process.env.DB_FILE_NAME ??
  path.join(os.homedir(), ".phoenix", ".gh-comment-watch", "local.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbFile,
  },
});
