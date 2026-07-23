import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const requireCjs = createRequire(import.meta.url);
const cjsEntry = fileURLToPath(
  new URL("../dist/src/index.js", import.meta.url)
);
const esmEntry = new URL("../dist/esm/index.js", import.meta.url).href;

/**
 * Guards the published entry points: the CommonJS build must stay loadable
 * with require() even though @arizeai/openinference-vercel is ESM-only
 * (vitest itself always runs ESM, so without this the require() path is
 * never exercised). Skipped when the package has not been built.
 */
describe.skipIf(!existsSync(cjsEntry))("built entry points", () => {
  test("the CommonJS entry loads via require()", () => {
    const otel: { register?: unknown } = requireCjs(cjsEntry);
    expect(typeof otel.register).toBe("function");
  });

  test("the ESM entry loads via import()", async () => {
    const otel: { register?: unknown } = await import(esmEntry);
    expect(typeof otel.register).toBe("function");
  });
});
