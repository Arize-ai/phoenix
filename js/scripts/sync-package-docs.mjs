import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDocMap = {
  "phoenix-client": {
    sourceDir:
      "docs/phoenix/sdk-api-reference/typescript/packages/phoenix-client",
    targetDir: "js/packages/phoenix-client/docs",
  },
  "phoenix-evals": {
    sourceDir:
      "docs/phoenix/sdk-api-reference/typescript/packages/phoenix-evals",
    targetDir: "js/packages/phoenix-evals/docs",
  },
  "phoenix-otel": {
    sourceDir:
      "docs/phoenix/sdk-api-reference/typescript/packages/phoenix-otel",
    targetDir: "js/packages/phoenix-otel/docs",
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function copyDirectory(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entryName of readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entryName);
    const targetPath = path.join(targetDir, entryName);
    const entryStats = statSync(sourcePath);

    if (entryStats.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function cleanPackageDocs(packageName) {
  const packageConfig = packageDocMap[packageName];

  if (!packageConfig) {
    const supportedPackages = Object.keys(packageDocMap).join(", ");
    throw new Error(
      `Unsupported package "${packageName}". Expected one of: ${supportedPackages}`
    );
  }

  const targetDir = path.join(repoRoot, packageConfig.targetDir);
  rmSync(targetDir, { recursive: true, force: true });

  console.log(`Removed generated docs for ${packageName}`);
}

function syncPackageDocs(packageName) {
  const packageConfig = packageDocMap[packageName];

  if (!packageConfig) {
    const supportedPackages = Object.keys(packageDocMap).join(", ");
    throw new Error(
      `Unsupported package "${packageName}". Expected one of: ${supportedPackages}`
    );
  }

  const sourceDir = path.join(repoRoot, packageConfig.sourceDir);
  const targetDir = path.join(repoRoot, packageConfig.targetDir);

  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Missing package docs source directory: ${sourceDir}`);
  }

  rmSync(targetDir, { recursive: true, force: true });
  copyDirectory(sourceDir, targetDir);

  const overviewPath = path.join(targetDir, "overview.mdx");
  if (!existsSync(overviewPath)) {
    throw new Error(
      `Expected overview.mdx in generated docs for ${packageName}`
    );
  }

  console.log(
    `Synced ${packageName} docs from ${packageConfig.sourceDir} to ${packageConfig.targetDir}`
  );
}

const args = process.argv.slice(2);
const action = args[0] === "clean" ? "clean" : "sync";
const packageNames = action === "clean" ? args.slice(1) : args;
const packagesToSync =
  packageNames.length > 0 ? packageNames : Object.keys(packageDocMap);

for (const packageName of packagesToSync) {
  if (action === "clean") {
    cleanPackageDocs(packageName);
    continue;
  }

  syncPackageDocs(packageName);
}
