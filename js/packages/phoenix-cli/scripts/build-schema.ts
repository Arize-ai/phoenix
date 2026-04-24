import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { toJSONSchema } from "zod/v4/core";

import { ProfilesFileSchema } from "../src/profiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const outDir = path.join(repoRoot, "schemas");
const outFile = path.join(outDir, "phoenix-cli-settings-1.json");

const schema = toJSONSchema(ProfilesFileSchema, { target: "draft-7" });

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(schema, null, 2) + "\n");

// Run the repo's JSON formatter on the emitted schema so the committed
// artifact matches `fmt:check`. Without this, `JSON.stringify` produces
// multi-line `required` arrays that oxfmt flags as unformatted.
execFileSync(
  path.join(repoRoot, "js", "node_modules", ".bin", "oxfmt"),
  ["--config", path.join(repoRoot, ".oxfmtrc.jsonc"), outFile],
  { stdio: "inherit" }
);

process.stdout.write(`Written: ${outFile}\n`);
