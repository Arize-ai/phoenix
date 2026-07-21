/**
 * Full-flow setup tests: scripted select answers through fake deps.
 * Real fs only via temp dirs.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { headlessSummary } from "../../src/commands/formatSetup";
import type { SetupDeps } from "../../src/setup/deps";
import {
  HeadlessInputError,
  SetupCancelledError,
} from "../../src/setup/errors";
import type { SetupOptions } from "../../src/setup/options";
import { runInstrument, runSetup } from "../../src/setup/runSetup";
import {
  CANCEL,
  buildFakeDeps,
  fakeFetch,
  gitExecFake,
  jsonResponse,
  resolveFakeInputs,
  scriptedPrompter,
} from "./fakes";

const LOCAL = "http://localhost:6006";

/**
 * Resolve inputs and run the lane the way the command layer does. Async so a
 * resolution failure surfaces as a rejection, like the lane's own errors.
 */
async function runSetupLane(deps: SetupDeps, options: SetupOptions = {}) {
  return runSetup(deps, resolveFakeInputs(deps, options));
}

async function runInstrumentLane(deps: SetupDeps, options: SetupOptions = {}) {
  return runInstrument(deps, resolveFakeInputs(deps, options));
}

/** Span-search poll handler: one span arrives immediately. */
function spansFound(url: string) {
  return url.includes("/spans?")
    ? jsonResponse(200, { data: [{ id: "span1" }] })
    : undefined;
}

/** Auth probe 200s; the verification poll sees a span. */
function authOffFetch() {
  return fakeFetch(spansFound, (url) =>
    url.includes("/v1/projects?limit=1")
      ? jsonResponse(200, { data: [] })
      : undefined
  );
}

/** Auth probe 401s without a key; the key check 200s for `accepted` keys. */
function authOnFetch(accepted: string[]) {
  return fakeFetch(spansFound, (url, request) => {
    if (!url.includes("/v1/projects?limit=1")) {
      return undefined;
    }
    const key = request.headers.get("authorization")?.replace(/^Bearer /, "");
    return key && accepted.includes(key)
      ? jsonResponse(200, { data: [] })
      : jsonResponse(401, { detail: "unauthorized" });
  });
}

describe("runSetup", () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-setup-"));
    settingsPath = path.join(dir, "px-settings.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("auth-off happy path via the manual lane", async () => {
    const prompter = scriptedPrompter([
      "local", // endpoint
      "my-app", // project name
      "manual", // instrumentation mode
      true, // I've finished instrumenting
      // verification succeeds via the API poll — no checkpoint
      false, // no px profile
      false, // no global CLI install (px not on PATH in the git fake)
      false, // no skills install
    ]);
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });

    const result = await runSetupLane(deps);
    expect(result.headless).toBe(false);
    expect(result.authEnabled).toBe(false);
    expect(result.connection).toEqual({
      endpoint: LOCAL,
      projectName: "my-app",
    });

    const env = fs.readFileSync(path.join(dir, ".env.phoenix"), "utf-8");
    expect(env).toContain('PHOENIX_PROJECT_NAME="my-app"');
    expect(env).not.toContain("PHOENIX_API_KEY");
    // Traces URL surfaced at the verification checkpoint.
    expect(
      prompter.output.some((message) =>
        message.includes(`${LOCAL}/redirects/projects/my-app`)
      )
    ).toBe(true);
  });

  it("auth-on happy path with a pasted API key", async () => {
    const prompter = scriptedPrompter([
      "my-app", // project name
      "sk-pasted", // API key
      "clipboard", // instrumentation mode
      true, // I've run the prompt
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      processes: { exec: gitExecFake() },
      fetch: authOnFetch(["sk-pasted"]),
    });

    const result = await runSetupLane(deps, { endpoint: LOCAL });
    expect(result.authEnabled).toBe(true);
    expect(result.connection.apiKey).toBe("sk-pasted");

    const env = fs.readFileSync(path.join(dir, ".env.phoenix"), "utf-8");
    expect(env).toContain('PHOENIX_API_KEY="sk-pasted"');
  });

  it("re-prompts only for a rejected API key", async () => {
    const prompter = scriptedPrompter([
      "my-app", // project name
      "sk-rejected", // API key
      "sk-pasted", // replacement API key
      "manual",
      true,
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      processes: { exec: gitExecFake() },
      fetch: authOnFetch(["sk-pasted"]),
    });

    const result = await runSetupLane(deps, { endpoint: LOCAL });
    expect(result.connection.apiKey).toBe("sk-pasted");
    expect(
      prompter.transcript.filter((message) => message === "Phoenix API key")
    ).toHaveLength(2);
    expect(
      prompter.transcript.filter(
        (message) => message === "Phoenix project name for this app's traces"
      )
    ).toHaveLength(1);
  });

  it("launches a detected coding agent with credentials injected", async () => {
    const prompter = scriptedPrompter([
      "local", // endpoint
      "my-app", // project name
      "agent:claude", // hand off to Claude Code
      false, // no docs MCP — keep the docs download
      // agent exits, verification succeeds via the API poll — no checkpoint
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    const git = gitExecFake();
    const launched: Array<{
      command: string;
      args: string[];
      env?: Record<string, string>;
      cwd?: string;
    }> = [];
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      fetch: authOffFetch(),
      processes: {
        exec: async (spec) =>
          spec.command === "claude" && spec.args[0] === "--version"
            ? { exitCode: 0, stdout: "1.0.0\n", stderr: "" }
            : git(spec),
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    await runSetupLane(deps);
    expect(launched).toHaveLength(1);
    expect(launched[0]?.command).toBe("claude");
    expect(launched[0]?.cwd).toBe(dir);
    expect(launched[0]?.args?.[0]).toContain('project name "my-app"');
    expect(launched[0]?.env).toMatchObject({
      PHOENIX_COLLECTOR_ENDPOINT: LOCAL,
      PHOENIX_PROJECT_NAME: "my-app",
    });
  });

  it("accepting the docs MCP offer replaces the docs download", async () => {
    const prompter = scriptedPrompter([
      "local", // endpoint
      "my-app", // project name
      "agent:claude", // hand off to Claude Code
      true, // yes, connect the docs MCP
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    const git = gitExecFake();
    const launched: Array<{ args: string[] }> = [];
    const mcpCommands: string[][] = [];
    let docsFetched = false;
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      fetch: authOffFetch(),
      fetchDocs: async () => {
        docsFetched = true;
        throw new Error("prefetch must not run when the MCP is connected");
      },
      processes: {
        exec: async (spec) => {
          if (spec.command === "claude" && spec.args[0] === "--version") {
            return { exitCode: 0, stdout: "1.0.0\n", stderr: "" };
          }
          if (spec.command === "claude" && spec.args[0] === "mcp") {
            mcpCommands.push(spec.args);
            return { exitCode: 0, stdout: "", stderr: "" };
          }
          return git(spec);
        },
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await runSetupLane(deps);
    expect(docsFetched).toBe(false);
    expect(result.docs).toBeUndefined();
    // Claude registers through its own CLI (local scope) — no repo file.
    expect(result.docsMcp).toEqual({
      outcome: "configured",
      agents: ["claude"],
      files: [],
    });
    expect(fs.existsSync(path.join(dir, ".mcp.json"))).toBe(false);
    expect(
      mcpCommands.some(
        (args) => args[1] === "add" && args.at(-1)?.startsWith("https://")
      )
    ).toBe(true);
    // The hand-off prompt steers the agent at the MCP server, not local docs.
    expect(launched[0]?.args?.[0]).toContain('"phoenix-docs" MCP server');
    expect(launched[0]?.args?.[0]).not.toContain(".px/docs");
  });

  it("headless --docs-mcp configures the pinned agent without prompting", async () => {
    const prompter = scriptedPrompter([]);
    const git = gitExecFake();
    const mcpCommands: Array<{ args: string[]; cwd?: string }> = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      fetchDocs: async () => {
        throw new Error("prefetch must not run when the MCP is connected");
      },
      processes: {
        exec: async (spec) => {
          if (spec.command === "claude" && spec.args[0] === "--version") {
            return { exitCode: 0, stdout: "1.0.0\n", stderr: "" };
          }
          if (spec.command === "claude" && spec.args[0] === "mcp") {
            mcpCommands.push(spec);
            return { exitCode: 0, stdout: "", stderr: "" };
          }
          return git(spec);
        },
      },
    });

    const result = await runSetupLane(deps, {
      noInput: true,
      instrument: true,
      agent: "claude",
      bypassPermissions: true,
      docsMcp: true,
      endpoint: LOCAL,
      project: "my-app",
    });
    expect(prompter.transcript).toEqual([]);
    expect(result.docsMcp?.outcome).toBe("configured");
    expect(result.docs).toBeUndefined();
    // Registered in the repo directory — claude's local scope is per-project.
    expect(mcpCommands.length).toBeGreaterThan(0);
    expect(mcpCommands.every((spec) => spec.cwd === dir)).toBe(true);
  });

  it("a drifted MCP install can never take setup down with it", async () => {
    const prompter = scriptedPrompter([]);
    const git = gitExecFake();
    const launched: Array<{ args: string[] }> = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: {
        exec: async (spec) => {
          if (spec.command === "claude" && spec.args[0] === "--version") {
            return { exitCode: 0, stdout: "1.0.0\n", stderr: "" };
          }
          if (spec.command === "claude" && spec.args[0] === "mcp") {
            // Harsher than a non-zero exit: the exec seam itself misbehaving.
            throw new Error("mcp subcommand went away");
          }
          return git(spec);
        },
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await runSetupLane(deps, {
      noInput: true,
      instrument: true,
      agent: "claude",
      bypassPermissions: true,
      docsMcp: true,
      endpoint: LOCAL,
      project: "my-app",
    });
    // The run completed: docs downloaded instead, agent launched, traces
    // verified — the MCP failure cost nothing but the optimization.
    expect(result.docsMcp?.outcome).toBe("failed");
    expect(result.docs?.outputDir).toBe(".px/docs");
    expect(result.tracesVerified).toBe(true);
    expect(launched).toHaveLength(1);
  });

  it("offers a finish-anyway escape hatch when no traces arrive", async () => {
    const prompter = scriptedPrompter([
      "local", // endpoint
      "my-app", // project name
      "manual", // instrumentation mode
      true, // I've finished instrumenting
      false, // stop watching, finish setup
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    let clock = 0;
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      // Probe succeeds; the span poll never finds data.
      fetch: fakeFetch(
        (url) =>
          url.includes("/spans?") ? jsonResponse(200, { data: [] }) : undefined,
        (url) =>
          url.includes("/v1/projects?limit=1")
            ? jsonResponse(200, { data: [] })
            : undefined
      ),
      processes: { exec: gitExecFake() },
      clock: { now: () => (clock += 61_000) },
    });

    const result = await runSetupLane(deps);
    expect(result.headless).toBe(false);
    expect(
      prompter.output.some((message) => message.includes("Not seeing traces?"))
    ).toBe(true);
  });

  it("cancelling any prompt unwinds with SetupCancelledError", async () => {
    const prompter = scriptedPrompter([CANCEL]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    await expect(runSetupLane(deps)).rejects.toThrow(SetupCancelledError);
  });

  it("declining the dirty-tree gate stops as a cancel", async () => {
    const prompter = scriptedPrompter([false]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake({ dirtyFiles: ["src/app.py"] }) },
    });
    await expect(runSetupLane(deps)).rejects.toThrow(SetupCancelledError);
  });

  it("headless runs steps 1–4 only and prompts for nothing", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    const result = await runSetupLane(deps, {
      noInput: true,
      endpoint: LOCAL,
      project: "my-app",
    });
    expect(result.headless).toBe(true);
    expect(prompter.transcript).toEqual([]);
    expect(fs.existsSync(path.join(dir, ".env.phoenix"))).toBe(true);

    const summary = headlessSummary(result);
    expect(summary).toContain("project: my-app");
    expect(summary).not.toContain("sk-");
  });

  it("headless without a project exits with the exact remediation", async () => {
    const deps = buildFakeDeps({
      context: { cwd: dir },
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    await expect(
      runSetupLane(deps, { noInput: true, endpoint: LOCAL })
    ).rejects.toThrow(HeadlessInputError);
  });

  it("headless without an endpoint exits instead of prompting", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    await expect(
      runSetupLane(deps, { noInput: true, project: "my-app" })
    ).rejects.toThrow(HeadlessInputError);
    expect(prompter.transcript).toEqual([]);
  });

  it("headless --instrument without --agent exits before touching source", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    await expect(
      runSetupLane(deps, {
        noInput: true,
        instrument: true,
        endpoint: LOCAL,
        project: "my-app",
      })
    ).rejects.toThrow(HeadlessInputError);
    expect(fs.existsSync(path.join(dir, ".env.phoenix"))).toBe(false);
  });

  it("headless setup --agent runs the agent in background and verifies traces", async () => {
    const prompter = scriptedPrompter([]);
    const git = gitExecFake();
    const launched: Array<{ command: string; args: string[] }> = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: {
        exec: async (spec) =>
          spec.command === "claude" && spec.args[0] === "--version"
            ? { exitCode: 0, stdout: "1.0.0\n", stderr: "" }
            : git(spec),
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await runSetupLane(deps, {
      noInput: true,
      instrument: true,
      agent: "claude",
      bypassPermissions: true,
      endpoint: LOCAL,
      project: "my-app",
    });
    expect(prompter.transcript).toEqual([]);
    expect(result.instrumentation).toEqual({
      kind: "agent",
      agent: "claude",
      exitCode: 0,
    });
    expect(result.tracesVerified).toBe(true);
    expect(result.docs?.outputDir).toBe(".px/docs");
    expect(launched[0]?.args.slice(0, 2)).toEqual([
      "-p",
      "--dangerously-skip-permissions",
    ]);
    // Headless stops before the tooling prompts.
    expect(result.tooling).toBeUndefined();
  });

  it("checks git safety before docs prefetch writes into the repository", async () => {
    const git = gitExecFake();
    const deps = buildFakeDeps({
      context: { cwd: dir },
      fetch: authOffFetch(),
      fetchDocs: async (options) => {
        fs.mkdirSync(path.join(dir, ".px", "docs"), { recursive: true });
        return {
          outputDir: ".px/docs",
          workflows: options.workflows ?? ["tracing"],
          written: 1,
          failed: 0,
          hasPagesOnDisk: true,
        };
      },
      processes: {
        exec: async (spec) => {
          if (spec.command === "claude" && spec.args[0] === "--version") {
            return { exitCode: 0, stdout: "1.0.0\n", stderr: "" };
          }
          if (
            spec.command === "git" &&
            spec.args[0] === "status" &&
            fs.existsSync(path.join(dir, ".px"))
          ) {
            return { exitCode: 0, stdout: "?? .px/\n", stderr: "" };
          }
          return git(spec);
        },
      },
    });

    const result = await runSetupLane(deps, {
      noInput: true,
      instrument: true,
      agent: "claude",
      bypassPermissions: true,
      endpoint: LOCAL,
      project: "my-app",
    });

    expect(result.tracesVerified).toBe(true);
    expect(result.docs?.written).toBe(1);
  });

  it("`px setup instrument` headless without --agent exits, with --agent runs", async () => {
    const buildDeps = () => {
      const git = gitExecFake();
      return buildFakeDeps({
        context: { cwd: dir },
        prompter: scriptedPrompter([]),
        fetch: authOffFetch(),
        processes: {
          exec: async (spec) =>
            spec.command === "claude" && spec.args[0] === "--version"
              ? { exitCode: 0, stdout: "1.0.0\n", stderr: "" }
              : git(spec),
        },
      });
    };
    const headlessOptions = (agent?: "claude"): SetupOptions => ({
      noInput: true,
      endpoint: LOCAL,
      project: "my-app",
      ...(agent ? { agent, bypassPermissions: true } : {}),
    });

    // The lane instruments by definition, so --instrument is never passed —
    // the headless agent rule must still hold.
    await expect(
      runInstrumentLane(buildDeps(), headlessOptions())
    ).rejects.toThrow(HeadlessInputError);

    const report = await runInstrumentLane(
      buildDeps(),
      headlessOptions("claude")
    );
    expect(report.instrumentation).toEqual({
      kind: "agent",
      agent: "claude",
      exitCode: 0,
    });
  });

  it("rejects an invalid --project name in interactive mode", async () => {
    const prompter = scriptedPrompter(["local"]); // endpoint select
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });
    await expect(runSetupLane(deps, { project: "team/app" })).rejects.toThrow(
      HeadlessInputError
    );
  });

  it("--api-url never leaks into the connection or hand-off files", async () => {
    const prompter = scriptedPrompter([
      "my-app", // project name (endpoint preset skips the select)
      "manual", // instrumentation mode
      true, // I've finished instrumenting
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      fetch: authOffFetch(),
      processes: { exec: gitExecFake() },
    });

    const result = await runSetupLane(deps, {
      endpoint: LOCAL,
      apiUrl: "http://localhost:9999",
    });
    expect(result.connection.endpoint).toBe(LOCAL);
    const env = fs.readFileSync(path.join(dir, ".env.phoenix"), "utf-8");
    expect(env).toContain(`PHOENIX_COLLECTOR_ENDPOINT="${LOCAL}"`);
    expect(env).not.toContain("9999");
  });

  it("pre-existing spans in the skew window do not satisfy verification", async () => {
    // One stale span sits 30s before instrumentation began — inside the
    // clock-skew window, so the baseline probe sees it but a query pinned to
    // the instrumentation start must not. Its timestamp is derived from the
    // first (baseline) span query so the test is independent of how many
    // times setup reads the clock beforehand.
    let staleSpanAtMs: number | undefined;
    const prompter = scriptedPrompter([
      "local", // endpoint
      "my-app", // project name
      "manual", // instrumentation mode
      true, // I've finished instrumenting
      false, // stop watching, finish setup
      false, // no px profile
      false, // no global CLI install
      false, // no skills install
    ]);
    let clock = 0;
    const deps = buildFakeDeps({
      context: { cwd: dir, settingsPath },
      prompter,
      fetch: fakeFetch(
        (url) => {
          if (!url.includes("/spans?")) {
            return undefined;
          }
          const startTime = new URL(url).searchParams.get("start_time");
          const windowStartMs = Date.parse(startTime ?? "");
          // The baseline query reaches back the full 60s skew; the stale
          // span is 30s inside that window.
          staleSpanAtMs ??= windowStartMs + 30_000;
          return jsonResponse(200, {
            data: windowStartMs <= staleSpanAtMs ? [{ id: "stale-span" }] : [],
          });
        },
        (url) =>
          url.includes("/v1/projects?limit=1")
            ? jsonResponse(200, { data: [] })
            : undefined
      ),
      processes: { exec: gitExecFake() },
      clock: {
        // Each read advances past the poll window so the timeout escape
        // hatch is reached instead of polling forever.
        now: () => {
          const value = clock;
          clock += 61_000;
          return value;
        },
      },
    });

    const result = await runSetupLane(deps);
    expect(result.headless).toBe(false);
    // The stale span was never accepted as verification.
    expect(
      prompter.output.some((message) => message.includes("Traces are flowing"))
    ).toBe(false);
    expect(
      prompter.output.some((message) => message.includes("Not seeing traces?"))
    ).toBe(true);
  });
});
