import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { toJSONSchema } from "zod/v4/core";

import { SettingsFileSchema } from "../src/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const outDir = path.join(repoRoot, "schemas");
const outFile = path.join(outDir, "phoenix-cli-settings.json");

const schema = toJSONSchema(SettingsFileSchema, { target: "draft-7" });

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(schema, null, 2) + "\n");

process.stdout.write(`Written: ${outFile}\n`);
