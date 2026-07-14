/**
 * Instrumentation hand-off tests: the `--agent` lane (probe, launch spec, run
 * mode) and the interactive lane prompt (agent / clipboard / manual).
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

    const lane = await instrumentApp(
      deps,
      { ...CONNECTION, apiKey: "sk-test" },
      {
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

    const lane = await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      agent: "claude",
      languages: [],
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
      authEnabled: false,
      agentDetection: detected(),
      agent: "claude",
      languages: [],
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
      authEnabled: false,
      agentDetection: detected(),
      agent: "claude",
      languages: [],
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
        authEnabled: false,
        agentDetection: detected("claude"),
        agent: "opencode",
        languages: [],
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
        authEnabled: false,
        agentDetection: detected(),
        // The command layer validates ids; the step defends the same contract.
        agent: "aider" as never,
        languages: [],
        mode: BACKGROUND_BYPASS,
      })
    ).rejects.toThrow(SetupFatalError);
  });
});

describe("instrumentApp lane prompt", () => {
  it("offers the detected agents and launches the chosen one", async () => {
    const prompter = scriptedPrompter(["agent:claude"]);
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

    const lane = await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected("claude", "cursor"),
      languages: [],
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "agent", agent: "claude", exitCode: 0 });
    expect(prompter.transcript).toEqual([
      "How do you want to instrument this app?",
    ]);
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

    const lane = await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      languages: [],
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

    const lane = await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      languages: [],
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

    const lane = await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      languages: [],
      mode: INTERACTIVE,
    });

    expect(lane).toEqual({ kind: "manual" });
    expect(prompter.output).toContain(
      "Follow the tracing quickstart: https://arize.com/docs/phoenix/quickstart"
    );
  });

  it("tells the agent where the prefetched docs landed", async () => {
    const prompter = scriptedPrompter(["clipboard", true]);
    const copied: string[] = [];
    const deps = buildFakeDeps({
      prompter,
      writeClipboard: async (text) => {
        copied.push(text);
        return true;
      },
    });

    await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      languages: [],
      mode: INTERACTIVE,
      docs: {
        outputDir: ".px/docs",
        workflows: ["tracing"],
        written: 3,
        failed: 0,
        hasPagesOnDisk: true,
      },
    });

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
    });

    await instrumentApp(deps, CONNECTION, {
      authEnabled: false,
      agentDetection: detected(),
      languages: [],
      mode: INTERACTIVE,
      // Every page failed and nothing was there from a previous run — sending
      // the agent to read an empty directory would be worse than the web.
      docs: {
        outputDir: ".px/docs",
        workflows: ["tracing"],
        written: 0,
        failed: 12,
        hasPagesOnDisk: false,
      },
    });

    expect(copied[0]).not.toContain(".px/docs");
  });
});
