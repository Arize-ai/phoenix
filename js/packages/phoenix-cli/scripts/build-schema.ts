import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { toJSONSchema } from "zod/v4/core";

import { ProfilesFileSchema } from "../src/profiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "schemas");
const outFile = path.join(outDir, "profile.schema.json");

const schema = toJSONSchema(ProfilesFileSchema, { target: "draft-7" });

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(schema, null, 2) + "\n");
console.log(`Written: ${outFile}`);
