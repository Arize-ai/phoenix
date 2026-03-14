import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const packageJsonPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json"
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

export const VERSION: string = packageJson.version;
