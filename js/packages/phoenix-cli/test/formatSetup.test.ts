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
  tracesVerified: true,
  tooling: { cli: "skipped", skills: "installed" },
  tracesUrl: "http://localhost:6006/redirects/projects/my-app",
};

function parse(format: "json" | "raw", report: SetupReport = REPORT) {
  const output: SetupOutput = JSON.parse(formatSetupOutput({ report, format }));
  return output;
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
      tracesVerified: undefined,
      tooling: undefined,
    });
    expect(output.instrumentation).toBeUndefined();
    expect(output.docs).toBeUndefined();
    expect(output.tooling).toBeUndefined();
    // Absent verification is reported as false, never omitted — agents branch
    // on this field.
    expect(output.tracesVerified).toBe(false);
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
});
