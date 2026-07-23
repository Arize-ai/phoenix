/**
 * Instrumentation hand-off tests: the `--agent` lane (probe, launch spec, run
 * mode), the interactive lane prompt (agent / clipboard / manual), and the
 * docs decision that now follows the lane choice (MCP offer vs prefetch).
 */

import { describe, expect, it } from "vitest";

import {
  getCodingAgent,
  type CodingAgent,
} from "../../src/setup/agents/registry";
import type { CommandSpec } from "../../src/setup/deps";
import { SetupFatalError } from "../../src/setup/errors";
import type { Connection } from "../../src/setup/steps/establishConnection";
import { instrumentApp } from "../../src/setup/steps/instrumentApp";
import { buildFakeDeps, scriptedPrompter } from "./fakes";

const CONNECTION: Connection = {
  endpoint: "http://localhost:6006",
  projectName: "my-app",
};

const INTERACTIVE = { background: false, bypassPermissions: false };
const BACKGROUND_BYPASS = { background: true, bypassPermissions: true };

/**
 * The docs-neutral baseline: prefetch disabled and the MCP offer declined by
 * flag, so lane-focused tests stay lane-focused.
 */
const NO_DOCS = {
  authEnabled: false,
  languages: [],
  headless: false,
  isGitRepository: false,
  docs: { enabled: false },
  docsMcp: false,
} as const;

function detected(...ids: Array<CodingAgent["id"]>): Promise<CodingAgent[]> {
  return Promise.resolve(
    ids.map((id) => {
      const agent = getCodingAgent(id);
      if (!agent) {
        throw new Error(`missing agent: ${id}`);
      }
      return agent;
    })
  );
}

/** Exec fake where only these binaries answer `--version`. */
function binariesOnPath(...binaries: string[]) {
  return async (spec: CommandSpec) =>
    binaries.includes(spec.command)
      ? { exitCode: 0, stdout: "1.0.0\n", stderr: "" }
      : { exitCode: 127, stdout: "", stderr: "command not found" };
}

describe("instrumentApp with --agent", () => {
  it("launches the named agent with the prompt, cwd and credentials", async () => {
    const prompter = scriptedPrompter([]);
    const launched: CommandSpec[] = [];
    const deps = buildFakeDeps({
      context: { cwd: "/repo" },
      prompter,
      processes: {
        exec: binariesOnPath("codex"),
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const { lane } = await instrumentApp(
      deps,
      { ...CONNECTION, apiKey: "sk-test" },
      {
        ...NO_DOCS,
        authEnabled: true,
        agentDetection: detected(),
        agent: "codex",
        languages: ["python"],
        mode: BACKGROUND_BYPASS,
      }
    );

    expect(lane).toEqual({ kind: "agent", agent: "codex", exitCode: 0 });
    // No lane prompt: --agent pre-answered it.
    expect(prompter.transcript).toEqual([]);
    expect(launched).toHaveLength(1);
    expect(launched[0]?.command).toBe("codex");
    expect(launched[0]?.cwd).toBe("/repo");
    expect(launched[0]?.args.slice(0, 2)).toEqual([
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
    ]);
    expect(launched[0]?.args.at(-1)).toContain('project name "my-app"');
    expect(launched[0]?.env).toEqual({
      PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
      PHOENIX_PROJECT_NAME: "my-app",
      PHOENIX_API_KEY: "sk-test",
    });
  });

  it("reports the agent's exit code and warns instead of failing", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      prompter,
      processes: {
        exec: binariesOnPath("claude"),
        spawnInteractive: async () => ({ exitCode: 2 }),
      },
    });

    const { lane } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      agentDetection: detected(),
      agent: "claude",
      mode: BACKGROUND_BYPASS,
    });

    expect(lane).toEqual({ kind: "agent", agent: "claude", exitCode: 2 });
    expect(
      prompter.output.some((message) =>
        message.includes("exited with an error")
      )
    ).toBe(true);
  });

  it("warns that a background run without --yolo will stall", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      prompter,
      processes: { exec: binariesOnPath("claude") },
    });

    await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      agentDetection: detected(),
      agent: "claude",
      mode: { background: true, bypassPermissions: false },
    });

    expect(prompter.output.some((message) => message.includes("--yolo"))).toBe(
      true
    );
  });

  it("does not warn about --yolo when the agent keeps its terminal", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      prompter,
      processes: { exec: binariesOnPath("claude") },
    });

    await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      agentDetection: detected(),
      agent: "claude",
      mode: INTERACTIVE,
    });

    expect(prompter.output.some((message) => message.includes("--yolo"))).toBe(
      false
    );
  });

  it("fails when the named agent's binary is not on PATH", async () => {
    const launched: CommandSpec[] = [];
    const deps = buildFakeDeps({
      processes: {
        exec: binariesOnPath(/* nothing installed */),
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    await expect(
      instrumentApp(deps, CONNECTION, {
        ...NO_DOCS,
        agentDetection: detected("claude"),
        agent: "opencode",
        mode: BACKGROUND_BYPASS,
      })
    ).rejects.toThrow(SetupFatalError);
    // A named-but-missing agent never silently falls back to another lane.
    expect(launched).toEqual([]);
  });

  it("fails on an unknown agent id", async () => {
    const deps = buildFakeDeps({
      processes: { exec: binariesOnPath("claude") },
    });
    await expect(
      instrumentApp(deps, CONNECTION, {
        ...NO_DOCS,
        agentDetection: detected(),
        // The command layer validates ids; the step defends the same contract.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- intentionally invalid agent id to exercise runtime validation
        agent: "aider" as never,
        mode: BACKGROUND_BYPASS,
      })
    ).rejects.toThrow(SetupFatalError);
  });
});

describe("instrumentApp lane prompt", () => {
  it("offers the detected agents, then the docs MCP for the chosen one", async () => {
    const prompter = scriptedPrompter(["agent:claude", false]);
    const launched: CommandSpec[] = [];
    const deps = buildFakeDeps({
      context: { cwd: "/repo" },
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const { lane, docsMcp } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docsMcp: undefined,
      agentDetection: detected("claude", "cursor"),
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "agent", agent: "claude", exitCode: 0 });
    expect(docsMcp?.outcome).toBe("declined");
    // The MCP offer comes after the lane choice — it targets the chosen agent.
    expect(prompter.transcript[0]).toBe(
      "How do you want to instrument this app?"
    );
    expect(prompter.transcript[1]).toContain("docs MCP server to Claude Code");
    expect(launched[0]?.command).toBe("claude");
    // Interactive: the agent keeps the terminal, no -p.
    expect(launched[0]?.args).toHaveLength(1);
  });

  it("copies the prompt to the clipboard and waits for the user", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const copied: string[] = [];
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async (text) => {
        copied.push(text);
        return true;
      },
    });

    const { lane } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      // The clipboard lane has no known agent, so the MCP question never
      // appears even when nothing suppressed it.
      docsMcp: undefined,
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "clipboard" });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('project name "my-app"');
    expect(
      prompter.output.some((message) =>
        message.includes("copied to your clipboard")
      )
    ).toBe(true);
  });

  it("prints the prompt when the clipboard write fails", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async () => false,
    });

    const { lane } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "clipboard" });
    expect(
      prompter.output.some((message) =>
        message.includes('project name "my-app"')
      )
    ).toBe(true);
  });

  it("points the manual lane at the quickstart docs", async () => {
    const prompter = scriptedPrompter(["manual", true]);
    const deps = buildFakeDeps({ prompter });

    const { lane } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "manual" });
    expect(prompter.output).toContain(
      "Follow the tracing quickstart: https://arize.com/docs/phoenix/quickstart"
    );
  });
});

describe("instrumentApp docs decision", () => {
  it("tells the agent where the prefetched docs landed", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const copied: string[] = [];
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async (text) => {
        copied.push(text);
        return true;
      },
      fetchDocs: async () => ({
        outputDir: ".px/docs",
        workflows: ["tracing"],
        written: 3,
        failed: 0,
        hasPagesOnDisk: true,
      }),
    });

    const { docs } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docs: { enabled: true },
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    expect(docs?.written).toBe(3);
    expect(copied[0]).toContain(".px/docs");
  });

  it("keeps the agent on the web when the docs directory has nothing in it", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const copied: string[] = [];
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async (text) => {
        copied.push(text);
        return true;
      },
      // Every page failed and nothing was there from a previous run — sending
      // the agent to read an empty directory would be worse than the web.
      fetchDocs: async () => ({
        outputDir: ".px/docs",
        workflows: ["tracing"],
        written: 0,
        failed: 12,
        hasPagesOnDisk: false,
      }),
    });

    await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docs: { enabled: true },
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    expect(copied[0]).not.toContain(".px/docs");
  });

  it("a connected docs MCP replaces the prefetch and steers the prompt", async () => {
    const prompter = scriptedPrompter([]);
    const launched: CommandSpec[] = [];
    let docsFetched = false;
    const deps = buildFakeDeps({
      prompter,
      fetchDocs: async () => {
        docsFetched = true;
        throw new Error("prefetch must not run when the MCP is connected");
      },
      processes: {
        exec: binariesOnPath("claude"),
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const { docs, docsMcp } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docs: { enabled: true },
      docsMcp: true,
      agentDetection: detected(),
      agent: "claude",
      headless: true,
      mode: BACKGROUND_BYPASS,
    });

    expect(docsFetched).toBe(false);
    expect(docs).toBeUndefined();
    expect(docsMcp).toEqual({
      outcome: "configured",
      agents: ["claude"],
      files: [],
    });
    const prompt = launched[0]?.args.at(-1);
    expect(prompt).toContain('"phoenix-docs" MCP server');
    expect(prompt).not.toContain(".px/docs");
  });

  it("survives an MCP install path that throws and falls back to the prefetch", async () => {
    const prompter = scriptedPrompter([]);
    const launched: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      fetchDocs: async () => ({
        outputDir: ".px/docs",
        workflows: ["tracing"],
        written: 3,
        failed: 0,
        hasPagesOnDisk: true,
      }),
      processes: {
        // The exec seam contractually never throws — this simulates exactly
        // the kind of drift the guard exists for.
        exec: async (spec) => {
          if (spec.args[0] === "mcp") {
            throw new Error("mcp subcommand went away");
          }
          return { exitCode: 0, stdout: "1.0.0\n", stderr: "" };
        },
        spawnInteractive: async (spec) => {
          launched.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const { lane, docs, docsMcp } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docs: { enabled: true },
      docsMcp: true,
      agentDetection: detected(),
      agent: "claude",
      headless: true,
      mode: BACKGROUND_BYPASS,
    });

    // Setup carried on: the failure was reported, the docs downloaded, and
    // the agent still launched with the local pages.
    expect(docsMcp?.outcome).toBe("failed");
    expect(docs?.written).toBe(3);
    expect(lane).toEqual({ kind: "agent", agent: "claude", exitCode: 0 });
    expect(launched[0]?.args.at(-1)).toContain(".px/docs");
    expect(
      prompter.output.some((message) =>
        message.includes("downloading the docs instead")
      )
    ).toBe(true);
  });

  it("says so when an explicit --docs-mcp meets a lane with no agent", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async () => true,
    });

    const { docsMcp } = await instrumentApp(deps, CONNECTION, {
      ...NO_DOCS,
      docsMcp: true,
      agentDetection: detected(),
      mode: INTERACTIVE,
    });

    // The flag can't be honored — there is no agent to configure — but it
    // must not be dropped silently.
    expect(docsMcp).toBeUndefined();
    expect(
      prompter.output.some((message) => message.includes("no coding agent"))
    ).toBe(true);
  });
});
