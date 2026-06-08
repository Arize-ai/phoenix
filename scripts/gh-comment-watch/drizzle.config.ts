import fs from "node:fs";
import { defineConfig } from "drizzle-kit";

fs.mkdirSync("./data", { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? "./data/local.db",
  },
});
