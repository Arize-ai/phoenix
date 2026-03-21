import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(currentFilePath), "..");
const packageJsonPath = path.join(packageRoot, "package.json");
const generatedDirPath = path.join(packageRoot, "src", "__generated__");
const generatedFilePath = path.join(generatedDirPath, "version.ts");

async function generateVersionModule() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
  const version = packageJson.version;

  if (typeof version !== "string" || version.length === 0) {
    throw new Error("Expected package.json to contain a string version field.");
  }

  const contents =
    "// This file is generated. Do not edit by hand.\n" +
    `export const CLI_VERSION = ${JSON.stringify(version)};\n`;

  await mkdir(generatedDirPath, { recursive: true });
  await writeFile(generatedFilePath, contents, "utf-8");
}

generateVersionModule().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    error instanceof Error
      ? error.message
      : "Failed to generate CLI version module."
  );
  process.exitCode = 1;
});
