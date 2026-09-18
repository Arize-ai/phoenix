/**
 * End-to-end tests: run the real oxlint binary with the built plugin against
 * the fixtures, with jev replaced by canned answers (`OXLINT_JEV_MODE=mock`).
 * The mock also records every request, so the tests double as a check on the
 * request shape and size that would be sent to jev.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const jsRoot = path.resolve(pkgRoot, "..", "..");
const require = createRequire(import.meta.url);

interface OxlintDiagnostic {
  message: string;
  code: string;
  severity: string;
  filename: string;
  labels: Array<{ span: { line: number; column: number } }>;
}

function oxlintBin(): string {
  const pkgDir = path.dirname(require.resolve("oxlint/package.json"));
  const { bin } = require("oxlint/package.json") as {
    bin: Record<string, string>;
  };
  return path.join(pkgDir, bin.oxlint ?? "bin/oxlint");
}

let cacheDir: string;
let diagnostics: OxlintDiagnostic[];

function byFixture(name: string): OxlintDiagnostic[] {
  return diagnostics.filter(
    (d) => d.filename.endsWith(`fixtures/${name}`) && d.code.startsWith("jev(")
  );
}

beforeAll(() => {
  cacheDir = mkdtempSync(path.join(os.tmpdir(), "oxlint-jev-test-"));
  const result = spawnSync(
    oxlintBin(),
    [
      "-c",
      "packages/oxlint-plugin-jev/demo.oxlintrc.json",
      "--format",
      "json",
      "packages/oxlint-plugin-jev/fixtures",
    ],
    {
      cwd: jsRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        OXLINT_JEV_MODE: "mock",
        OXLINT_JEV_CACHE_DIR: cacheDir,
        OXLINT_JEV_MOCK_FILE: path.join(pkgRoot, "test", "mock-answers.json"),
      },
    }
  );
  if (result.error) throw result.error;
  const parsed = JSON.parse(result.stdout) as {
    diagnostics: OxlintDiagnostic[];
  };
  diagnostics = parsed.diagnostics;
});

describe("import gate", () => {
  it("never asks jev about files without Phoenix/OpenInference/OTel imports", () => {
    expect(byFixture("unrelated.ts")).toEqual([]);
    const recorded = readdirSync(path.join(cacheDir, "requests")).map(
      (f) =>
        JSON.parse(
          readFileSync(path.join(cacheDir, "requests", f), "utf8")
        ) as { filename: string }
    );
    expect(recorded.some((r) => r.filename.endsWith("unrelated.ts"))).toBe(
      false
    );
  });
});

describe("flush-before-exit", () => {
  it("reports deterministically when nothing can ever flush", () => {
    const found = byFixture("bad-no-flush.ts");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("[jev:flush-before-exit]");
    expect(found[0]?.message).toContain("(p=1.00)");
    expect(found[0]?.labels[0]?.span.line).toBe(3);
  });

  it("skips exported providers and batch:false without asking jev", () => {
    expect(byFixture("exported-provider.ts")).toEqual([]);
    expect(
      byFixture("esm-import-order.ts").filter((d) =>
        d.message.includes("flush-before-exit")
      )
    ).toEqual([]);
  });

  it("reports when jev judges the flush covers only the success path", () => {
    const found = byFixture("bad-flush-success-only.ts");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toMatch(
      /not flushed on every exit path.*\(p=0\.92\)/
    );
  });

  it("stays quiet when jev judges every exit path flushes", () => {
    expect(byFixture("good-flush.ts")).toEqual([]);
    expect(byFixture("simple-processor.ts")).toEqual([]);
  });
});

describe("span-kind-matches-body", () => {
  it("reports only the span whose declared kind disagrees with jev's confident choice", () => {
    const found = byFixture("span-kind-mismatch.ts");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain(
      "declared CHAIN but the wrapped function behaves like a RETRIEVER"
    );
    expect(found[0]?.labels[0]?.span.line).toBe(8);
  });
});

describe("no-session-wrapper", () => {
  it("reports the wrapper anti-pattern", () => {
    const found = byFixture("session-wrapper.ts");
    expect(found.map((d) => d.message)).toEqual([
      expect.stringContaining("[jev:no-session-wrapper]"),
    ]);
  });
});

describe("esm-manual-instrumentation", () => {
  it("reports when jev classifies the module as relying on import order", () => {
    const found = byFixture("esm-import-order.ts");
    expect(found.map((d) => d.message)).toEqual([
      expect.stringContaining("[jev:esm-manual-instrumentation]"),
    ]);
  });
});

describe("no-sensitive-span-attributes", () => {
  it("reports the hardcoded key in code and each PII attribute plus the bulk input via jev, but not the token count", () => {
    const found = byFixture("pii-attributes.ts").map((d) => d.message);
    expect(found).toHaveLength(4);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /"metadata\.api_key" is a hardcoded 40-character string literal.*not sent to jev/
        ),
        expect.stringContaining('"metadata.patient_dob" carries personal'),
        expect.stringContaining('"metadata.chief_complaint" carries personal'),
        expect.stringContaining("serialize a whole record"),
      ])
    );
    expect(found.some((m) => m.includes("token_count"))).toBe(false);
  });

  it("stays quiet on operational attributes and on masked whole-record input", () => {
    expect(byFixture("benign-attributes.ts")).toEqual([]);
    expect(byFixture("pii-masked.ts")).toEqual([]);
  });
});

describe("redaction", () => {
  /** Only what came from the linted file: everything under state.code and state.facts. */
  function codeAndFacts(): Array<{ filename: string; text: string }> {
    return readdirSync(path.join(cacheDir, "requests")).map((f) => {
      const { filename, request } = JSON.parse(
        readFileSync(path.join(cacheDir, "requests", f), "utf8")
      );
      return {
        filename,
        text: JSON.stringify({
          code: request.state.code,
          facts: request.state.facts,
        }),
      };
    });
  }

  it("never sends string literal values from the linted file, only their lengths", () => {
    const entries = codeAndFacts();
    expect(entries.length).toBeGreaterThan(0);
    for (const { text } of entries) {
      expect(text).not.toContain("sk-live-");
      expect(text).not.toContain("Fatal error");
      expect(text).not.toContain("gpt-4o-mini");
    }
    const pii =
      entries.find((e) => e.filename.endsWith("pii-attributes.ts"))?.text ?? "";
    expect(pii).toContain('\\"<str:40>\\"');
    // The pasted key survives only as its length, and is not listed as a dynamic attribute.
    expect(pii).toContain('\\"metadata.api_key\\": \\"<str:40>\\"');
    expect(pii).not.toMatch(/"key":"metadata\.api_key"/);
  });

  it("keeps structural strings: property keys, import sources and span kind/name", () => {
    const pii =
      codeAndFacts().find((e) => e.filename.endsWith("pii-attributes.ts"))
        ?.text ?? "";
    expect(pii).toContain("metadata.patient_dob");
    expect(pii).toContain("@arizeai/openinference-core");
    expect(pii).toContain('kind: \\"CHAIN\\"');
    expect(pii).toContain('name: \\"summarize-visit\\"');
  });
});

describe("request shape", () => {
  it("puts code, facts and the cited guidance into state and stays well under jev's 32k-token state budget", () => {
    const files = readdirSync(path.join(cacheDir, "requests"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const { request } = JSON.parse(
        readFileSync(path.join(cacheDir, "requests", file), "utf8")
      );
      expect(request.model).toBe("jev-latest");
      expect(Object.keys(request.state)).toEqual([
        "file",
        "code",
        "facts",
        "guidance",
      ]);
      for (const entries of Object.values(request.state.guidance) as Array<
        Array<{ source: string; text: string }>
      >) {
        for (const g of entries) {
          expect(g.source).toMatch(/^phoenix-tracing\//);
          expect(g.text.length).toBeGreaterThan(50);
        }
      }
      const approxTokens = JSON.stringify(request.state).length / 4;
      expect(approxTokens).toBeLessThan(8_000);
    }
  });
});
