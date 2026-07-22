import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const requireCjs = createRequire(import.meta.url);
// The ./vitest subpath is intentionally absent: vitest itself refuses to be
// require()d (its CJS stub throws), so that entry is only usable from ESM.
const cjsEntries = {
  index: "../dist/src/index.js",
  experiments: "../dist/src/experiments/index.js",
  jest: "../dist/src/jest/index.js",
} as const;
const cjsIndexPath = fileURLToPath(new URL(cjsEntries.index, import.meta.url));

/**
 * Guards the published CommonJS entry points — they transitively load
 * @arizeai/phoenix-otel, whose OpenInference span processors come from an
 * ESM-only package. Vitest always runs ESM, so without this the require()
 * paths are never exercised. Skipped when the package has not been built.
 */
describe.skipIf(!existsSync(cjsIndexPath))(
  "built CommonJS entry points",
  () => {
    for (const [name, relativePath] of Object.entries(cjsEntries)) {
      test(`the ${name} entry loads via require()`, () => {
        const entryPath = fileURLToPath(new URL(relativePath, import.meta.url));
        const loaded = requireCjs(entryPath) as Record<string, unknown>;
        expect(Object.keys(loaded).length).toBeGreaterThan(0);
      });
    }
  }
);
