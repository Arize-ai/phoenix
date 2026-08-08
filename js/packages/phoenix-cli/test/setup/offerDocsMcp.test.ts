/**
 * Docs MCP offer tests. The CLI lane (claude registers through its own `mcp`
 * subcommand) is exercised through an exec spy; the file lane (cursor,
 * opencode) writes real temp dirs.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DOCS_MCP_SERVER_URL,
  getCodingAgent,
  type CodingAgent,
  type CodingAgentId,
} from "../../src/setup/agents/registry";
import type { CommandSpec } from "../../src/setup/deps";
import { offerDocsMcp } from "../../src/setup/steps/offerDocsMcp";
import { buildFakeDeps, scriptedPrompter } from "./fakes";

function agent(id: CodingAgentId): CodingAgent {
  const found = getCodingAgent(id);
  if (!found) {
    throw new Error(`unknown agent in test: ${id}`);
  }
  return found;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

describe("offerDocsMcp", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-docs-mcp-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("registers claude through its own CLI and verifies the entry landed", async () => {
    const prompter = scriptedPrompter([]);
    const execs: CommandSpec[] = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      processes: {
        exec: async (spec) => {
          execs.push(spec);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("claude"),
      headless: true,
      docsEnabled: true,
    });

    expect(result).toEqual({
      outcome: "configured",
      agents: ["claude"],
      files: [],
    });
    expect(prompter.transcript).toEqual([]);
    // The clean path: add, then read the entry back. No remove — nothing to
    // remove, and running it up front would risk a working registration.
    expect(execs.map((spec) => spec.args)).toEqual([
      [
        "mcp",
        "add",
        "--transport",
        "http",
        "phoenix-docs",
        DOCS_MCP_SERVER_URL,
      ],
      ["mcp", "get", "phoenix-docs"],
    ]);
    // Local scope is keyed by directory — the exec must run in the repo.
    expect(execs.every((spec) => spec.cwd === dir)).toBe(true);
    expect(execs.every((spec) => spec.command === "claude")).toBe(true);
    // Nothing lands in the repo on the CLI lane.
    expect(fs.existsSync(path.join(dir, ".mcp.json"))).toBe(false);
  });

  it("an add refused because the entry exists is retried through remove", async () => {
    const calls: string[][] = [];
    let adds = 0;
    const deps = buildFakeDeps({
      context: { cwd: dir },
      processes: {
        exec: async (spec) => {
          calls.push(spec.args);
          if (spec.args[1] === "add" && ++adds === 1) {
            return {
              exitCode: 1,
              stdout: "",
              stderr: "phoenix-docs already exists",
            };
          }
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("claude"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("configured");
    // add (refused) → get (entry exists) → remove → add → get (read-back).
    expect(calls.map((args) => args[1])).toEqual([
      "add",
      "get",
      "remove",
      "add",
      "get",
    ]);
  });

  it("a failing add falls back with the CLI's own stderr, never removing an entry it didn't confirm", async () => {
    const prompter = scriptedPrompter([]);
    const calls: string[][] = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      processes: {
        // The add is broken and no phoenix-docs entry exists — the drifted-CLI
        // case on a fresh machine. Nothing must be removed.
        exec: async (spec) => {
          calls.push(spec.args);
          if (spec.args[1] === "add") {
            return {
              exitCode: 2,
              stdout: "",
              stderr: "unknown option --transport",
            };
          }
          return { exitCode: 1, stdout: "", stderr: "not found" };
        },
      },
    });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("claude"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("failed");
    expect(calls.every((args) => args[1] !== "remove")).toBe(true);
    expect(
      prompter.output.some((message) =>
        message.includes("unknown option --transport")
      )
    ).toBe(true);
    expect(
      prompter.output.some((message) =>
        message.includes("downloading the docs instead")
      )
    ).toBe(true);
  });

  it("an exec seam that throws is reported and never escapes the step", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      processes: {
        exec: async () => {
          throw new Error("mcp subcommand went away");
        },
      },
    });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("claude"),
      headless: true,
      docsEnabled: false,
    });

    expect(result.outcome).toBe("failed");
    // With --no-docs there is no download to promise.
    expect(
      prompter.output.some((message) =>
        message.includes("read the docs from the web")
      )
    ).toBe(true);
    expect(
      prompter.output.every(
        (message) => !message.includes("downloading the docs instead")
      )
    ).toBe(true);
  });

  it("an add that 'succeeds' without registering the entry is caught by the read-back", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      processes: {
        // remove and add exit 0, but the entry never shows up in `mcp get`.
        exec: async (spec) =>
          spec.args[1] === "get"
            ? { exitCode: 1, stdout: "", stderr: "not found" }
            : { exitCode: 0, stdout: "", stderr: "" },
      },
    });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("claude"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("failed");
    expect(
      prompter.output.some((message) => message.includes("did not show up"))
    ).toBe(true);
  });

  it("writes cursor's config file, preserving servers already in it", async () => {
    const cursorConfig = path.join(dir, ".cursor", "mcp.json");
    fs.mkdirSync(path.dirname(cursorConfig), { recursive: true });
    fs.writeFileSync(
      cursorConfig,
      JSON.stringify({ mcpServers: { mine: { command: "my-mcp" } } })
    );
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    const result = await offerDocsMcp(deps, {
      agent: agent("cursor"),
      headless: false,
      docsEnabled: true,
    });

    expect(result).toEqual({
      outcome: "configured",
      agents: ["cursor"],
      // Forward-slash on every platform — the report must stay stable.
      files: [".cursor/mcp.json"],
    });
    expect(readJson(cursorConfig)).toEqual({
      mcpServers: {
        mine: { command: "my-mcp" },
        "phoenix-docs": { url: DOCS_MCP_SERVER_URL },
      },
    });
  });

  it("replaces a pre-existing entry under the server name wholesale", async () => {
    const cursorConfig = path.join(dir, ".cursor", "mcp.json");
    fs.mkdirSync(path.dirname(cursorConfig), { recursive: true });
    // A stdio-style entry from an earlier manual install: its keys must not
    // survive under the new url, or the agent may resolve the stale command.
    fs.writeFileSync(
      cursorConfig,
      JSON.stringify({
        mcpServers: {
          "phoenix-docs": { command: "npx", args: ["@arizeai/phoenix-mcp"] },
        },
      })
    );
    const deps = buildFakeDeps({ context: { cwd: dir } });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("cursor"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("configured");
    expect(readJson(cursorConfig)).toEqual({
      mcpServers: { "phoenix-docs": { url: DOCS_MCP_SERVER_URL } },
    });
  });

  it("creates opencode.json with its $schema, but never back-fills an existing file", async () => {
    const deps = () => buildFakeDeps({ context: { cwd: dir } });
    const configPath = path.join(dir, "opencode.json");
    const run = () =>
      offerDocsMcp(deps(), {
        docsMcp: true,
        agent: agent("opencode"),
        headless: true,
        docsEnabled: true,
      });

    await run();
    expect(readJson(configPath).$schema).toBe(
      "https://opencode.ai/config.json"
    );

    // A user file without $schema stays without it — setup only asserts its
    // own entry.
    fs.writeFileSync(configPath, JSON.stringify({ theme: "dark" }));
    await run();
    const rewritten = readJson(configPath);
    expect(rewritten.$schema).toBeUndefined();
    expect(rewritten.theme).toBe("dark");
    expect(rewritten.mcp).toEqual({
      "phoenix-docs": {
        type: "remote",
        url: DOCS_MCP_SERVER_URL,
        enabled: true,
      },
    });
  });

  it("declining keeps the repo and agent untouched", async () => {
    const prompter = scriptedPrompter([false]);
    const execs: CommandSpec[] = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      processes: {
        exec: async (spec) => {
          execs.push(spec);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });

    const result = await offerDocsMcp(deps, {
      agent: agent("claude"),
      headless: false,
      docsEnabled: true,
    });

    expect(result).toEqual({ outcome: "declined", agents: [], files: [] });
    expect(execs).toEqual([]);
  });

  it("names the agent in the offer", async () => {
    const prompter = scriptedPrompter([false]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    await offerDocsMcp(deps, {
      agent: agent("cursor"),
      headless: false,
      docsEnabled: true,
    });
    expect(prompter.transcript[0]).toContain("Cursor");
  });

  it("headless without --docs-mcp never touches agent config", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    const result = await offerDocsMcp(deps, {
      agent: agent("cursor"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("skipped");
    expect(fs.existsSync(path.join(dir, ".cursor"))).toBe(false);
  });

  it("--no-docs-mcp skips without prompting", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    const result = await offerDocsMcp(deps, {
      docsMcp: false,
      agent: agent("claude"),
      headless: false,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("skipped");
    expect(prompter.transcript).toEqual([]);
  });

  it("--docs-mcp with an agent that has no install path says so and skips", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    const result = await offerDocsMcp(deps, {
      docsMcp: true,
      agent: agent("codex"),
      headless: true,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("skipped");
    expect(prompter.output.some((message) => message.includes("Codex"))).toBe(
      true
    );
  });

  it("an unparseable existing config fails the offer instead of clobbering it", async () => {
    const cursorConfig = path.join(dir, ".cursor", "mcp.json");
    fs.mkdirSync(path.dirname(cursorConfig), { recursive: true });
    fs.writeFileSync(cursorConfig, "{ not json");
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({ context: { cwd: dir }, prompter });

    const result = await offerDocsMcp(deps, {
      agent: agent("cursor"),
      headless: false,
      docsEnabled: true,
    });

    expect(result.outcome).toBe("failed");
    expect(fs.readFileSync(cursorConfig, "utf-8")).toBe("{ not json");
    expect(
      prompter.output.some((message) =>
        message.includes("downloading the docs instead")
      )
    ).toBe(true);
  });

  it("re-running the file lane is idempotent", async () => {
    const run = () =>
      offerDocsMcp(buildFakeDeps({ context: { cwd: dir } }), {
        docsMcp: true,
        agent: agent("cursor"),
        headless: true,
        docsEnabled: true,
      });
    await run();
    const configPath = path.join(dir, ".cursor", "mcp.json");
    const first = fs.readFileSync(configPath, "utf-8");
    const second = await run();
    expect(second.outcome).toBe("configured");
    expect(fs.readFileSync(configPath, "utf-8")).toBe(first);
  });
});
