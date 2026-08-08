/**
 * Setup output tests: the JSON envelope agents key off (endpoint, project,
 * instrumentation lane, tracesVerified), and the raw single-line variant.
 */

import { describe, expect, it } from "vitest";

import {
  formatSetupOutput,
  type SetupOutput,
} from "../src/commands/formatSetup";
import type { SetupReport } from "../src/setup/runSetup";

const REPORT: SetupReport = {
  connection: {
    endpoint: "http://localhost:6006",
    projectName: "my-app",
    apiKey: "sk-secret",
  },
  authEnabled: true,
  headless: true,
  files: [".env.phoenix"],
  gitignored: [".env.phoenix"],
  docs: {
    outputDir: ".px/docs",
    workflows: ["tracing"],
    written: 7,
    failed: 1,
    hasPagesOnDisk: true,
  },
  instrumentation: { kind: "agent", agent: "claude", exitCode: 0 },
  verification: "verified",
  tooling: { cli: "skipped", skills: "installed" },
  tracesUrl: "http://localhost:6006/redirects/projects/my-app",
};

function parse(format: "json" | "raw", report: SetupReport = REPORT) {
  return JSON.parse(formatSetupOutput({ report, format })) as SetupOutput;
}

describe("formatSetupOutput", () => {
  it("json carries the endpoint, project, lane and verification result", () => {
    expect(parse("json")).toEqual({
      endpoint: "http://localhost:6006",
      project: "my-app",
      authEnabled: true,
      files: [".env.phoenix"],
      gitignored: [".env.phoenix"],
      tracesUrl: "http://localhost:6006/redirects/projects/my-app",
      docs: {
        outputDir: ".px/docs",
        workflows: ["tracing"],
        pages: 7,
        failed: 1,
      },
      instrumentation: { lane: "agent", agent: "claude", exitCode: 0 },
      tracesVerified: true,
      verification: "verified",
      tooling: { cli: "skipped", skills: "installed" },
    });
  });

  it("never emits the API key", () => {
    expect(formatSetupOutput({ report: REPORT, format: "json" })).not.toContain(
      "sk-secret"
    );
  });

  it("raw is the same envelope on a single line", () => {
    const raw = formatSetupOutput({ report: REPORT, format: "raw" });
    expect(raw).not.toContain("\n");
    expect(JSON.parse(raw)).toEqual(parse("json"));
  });

  it("a non-agent lane reports the lane alone", () => {
    const output = parse("json", {
      ...REPORT,
      instrumentation: { kind: "clipboard" },
    });
    expect(output.instrumentation).toEqual({ lane: "clipboard" });
  });

  it("a registration-only run has no lane and is not verified", () => {
    const { docs: _docs, ...base } = REPORT;
    const output = parse("json", {
      ...base,
      instrumentation: undefined,
      verification: undefined,
      tooling: undefined,
    });
    expect(output.instrumentation).toBeUndefined();
    expect(output.docs).toBeUndefined();
    expect(output.tooling).toBeUndefined();
    // Absent verification is reported as false, never omitted — agents branch
    // on this field.
    expect(output.tracesVerified).toBe(false);
    // But `verification` is omitted, which is the only thing distinguishing
    // "nothing to verify" (exit 0) from "no trace arrived" (exit 6) —
    // `tracesVerified` alone reads false for both.
    expect(output.verification).toBeUndefined();
  });

  it("json distinguishes a deferred wait from a failed one", () => {
    expect(
      parse("json", { ...REPORT, verification: "deferred" })
    ).toMatchObject({ tracesVerified: false, verification: "deferred" });
    expect(
      parse("json", { ...REPORT, verification: "notVerified" })
    ).toMatchObject({ tracesVerified: false, verification: "notVerified" });
  });

  it("a non-zero agent exit is reported, not swallowed", () => {
    const output = parse("json", {
      ...REPORT,
      instrumentation: { kind: "agent", agent: "codex", exitCode: 1 },
    });
    expect(output.instrumentation).toEqual({
      lane: "agent",
      agent: "codex",
      exitCode: 1,
    });
  });

  it("pretty prints the human summary and defaults to it", () => {
    const pretty = formatSetupOutput({ report: REPORT });
    expect(pretty).toContain("endpoint: http://localhost:6006");
    expect(pretty).toContain("project: my-app");
    expect(pretty).toContain("http://localhost:6006/redirects/projects/my-app");
    expect(pretty).not.toContain("sk-secret");
    expect(formatSetupOutput({ report: REPORT, format: "pretty" })).toBe(
      pretty
    );
  });

  // All of setup's narration goes to stderr, so for a caller reading stdout the
  // pretty summary is the entire report — it cannot be silent about the verdict.
  it("pretty states the verdict on an instrumented run", () => {
    const verified = formatSetupOutput({ report: REPORT });
    const notVerified = formatSetupOutput({
      report: { ...REPORT, verification: "notVerified" },
    });
    expect(verified).toContain("traces: verified");
    expect(notVerified).toContain("traces: NOT VERIFIED");
    expect(notVerified).toContain("no trace arrived");
    expect(notVerified).not.toBe(verified);
    // A verified run still has to say how to export the credentials: the trace
    // came from the process setup injected them into, not the user's shell.
    expect(verified).toContain("source .env.phoenix");
    expect(notVerified).toContain("source .env.phoenix");
  });

  it("pretty omits the verdict when nothing was instrumented", () => {
    const pretty = formatSetupOutput({
      report: {
        ...REPORT,
        instrumentation: undefined,
        verification: undefined,
      },
    });
    // A register-only run had nothing to verify; "not verified" would misread
    // as a failure of something it never attempted.
    expect(pretty).not.toMatch(/^traces: /m);
    expect(pretty).toContain("Instrument your app");
  });
});
