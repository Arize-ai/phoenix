import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const requireCjs = createRequire(import.meta.url);
const datasetLabelHelperNames = [
  "createDatasetLabel",
  "deleteDatasetLabel",
  "getDatasetLabel",
  "listDatasetLabels",
  "updateDatasetLabel",
] as const;

function expectDatasetLabelHelpers(loaded: Record<string, unknown>) {
  for (const helperName of datasetLabelHelperNames) {
    expect(loaded[helperName]).toBeTypeOf("function");
  }
}

// The ./vitest subpath is intentionally absent: vitest itself refuses to be
// require()d (its CJS stub throws), so that entry is only usable from ESM.
const cjsEntries = {
  datasets: "../dist/src/datasets/index.js",
  index: "../dist/src/index.js",
  experiments: "../dist/src/experiments/index.js",
  traces: "../dist/src/traces/index.js",
  jest: "../dist/src/jest/index.js",
  projects: "../dist/src/projects/index.js",
  users: "../dist/src/users/index.js",
} as const;
// The index entry transitively require()s @arizeai/phoenix-otel's dist via the
// workspace symlink, so an unbuilt sibling would fail the guard even though
// the published entry points are fine.
const requiredDist = [
  cjsEntries.index,
  "../node_modules/@arizeai/phoenix-otel/dist/src/index.js",
];
const isBuilt = requiredDist.every((path) =>
  existsSync(new URL(path, import.meta.url))
);
const isCi = process.env.CI != null && process.env.CI !== "false";
if (!isBuilt && isCi) {
  // Locally an unbuilt tree just skips; in CI a missing dist means the build
  // step or dist layout changed and the guard would silently self-disable.
  throw new Error(
    "dist/ is missing in CI — the CJS entry-point guard cannot run"
  );
}

/**
 * Guards the published CommonJS entry points — they transitively load
 * @arizeai/phoenix-otel, whose OpenInference span processors come from an
 * ESM-only package. Vitest always runs ESM, so without this the require()
 * paths are never exercised. Skipped when the package has not been built.
 */
describe.skipIf(!isBuilt)("built CommonJS entry points", () => {
  for (const [name, relativePath] of Object.entries(cjsEntries)) {
    test(`the ${name} entry loads via require()`, () => {
      const loaded = requireCjs(relativePath) as Record<string, unknown>;
      expect(Object.keys(loaded).length).toBeGreaterThan(0);
    });
  }

  test("the datasets entry exposes dataset-label helpers", () => {
    const loaded = requireCjs(cjsEntries.datasets) as Record<string, unknown>;
    expectDatasetLabelHelpers(loaded);
  });
});

const esmEntries = {
  datasets: "../dist/esm/datasets/index.js",
  index: "../dist/esm/index.js",
  experiments: "../dist/esm/experiments/index.js",
  traces: "../dist/esm/traces/index.js",
  jest: "../dist/esm/jest/index.js",
  projects: "../dist/esm/projects/index.js",
  users: "../dist/esm/users/index.js",
} as const;

describe.skipIf(!isBuilt)("built ESM entry points", () => {
  for (const [name, relativePath] of Object.entries(esmEntries)) {
    test(`the ${name} entry loads via import()`, async () => {
      const loaded = (await import(
        new URL(relativePath, import.meta.url).href
      )) as Record<string, unknown>;
      expect(Object.keys(loaded).length).toBeGreaterThan(0);
    });
  }

  test("the datasets entry exposes dataset-label helpers", async () => {
    const loaded = (await import(
      new URL(esmEntries.datasets, import.meta.url).href
    )) as Record<string, unknown>;
    expectDatasetLabelHelpers(loaded);
  });
});
