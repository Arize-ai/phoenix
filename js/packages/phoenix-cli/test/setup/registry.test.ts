/**
 * Registry tests: the argv each agent builds per run mode, the launch spec
 * handed to the spawn seam, and the binary probes — timeout hand-off to the
 * exec seam and PATH hygiene for the global-install check under package
 * runners (`npx`).
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildLaunchSpec,
  CODING_AGENT_IDS,
  getCodingAgent,
  pathWithoutPackageBins,
  probeBinary,
  probeGlobalBinary,
  type AgentRunMode,
  type CodingAgentId,
} from "../../src/setup/agents/registry";
import type { CommandSpec, ExecResult } from "../../src/setup/deps";
import type { Connection } from "../../src/setup/steps/establishConnection";
import { fakeProcesses, fakeRunContext } from "./fakes";

const PACKAGE_BIN = `/tmp/_npx/abc123/node_modules${path.sep}.bin`;

const PROMPT = "instrument this app";

const INTERACTIVE: AgentRunMode = {
  background: false,
  bypassPermissions: false,
};
const INTERACTIVE_BYPASS: AgentRunMode = {
  background: false,
  bypassPermissions: true,
};
const BACKGROUND: AgentRunMode = {
  background: true,
  bypassPermissions: false,
};
const BACKGROUND_BYPASS: AgentRunMode = {
  background: true,
  bypassPermissions: true,
};
/** The full mode matrix: interactive/background × bypass on/off. */
const ALL_MODES: AgentRunMode[] = [
  INTERACTIVE,
  INTERACTIVE_BYPASS,
  BACKGROUND,
  BACKGROUND_BYPASS,
];

/** The agent, or a failing lookup — every id in the registry must resolve. */
function agent(id: CodingAgentId) {
  const found = getCodingAgent(id);
  if (!found) {
    throw new Error(`missing agent: ${id}`);
  }
  return found;
}

function args(id: CodingAgentId, mode: AgentRunMode): string[] {
  return agent(id).launchArgs(PROMPT, mode);
}

function recordingExec(exitCode: number) {
  const specs: CommandSpec[] = [];
  const exec = async (spec: CommandSpec): Promise<ExecResult> => {
    specs.push(spec);
    return { exitCode, stdout: "", stderr: "" };
  };
  return { specs, processes: fakeProcesses(exec) };
}

describe("getCodingAgent", () => {
  it("resolves every advertised id", () => {
    expect(CODING_AGENT_IDS).toEqual(["claude", "codex", "opencode", "cursor"]);
    for (const id of CODING_AGENT_IDS) {
      expect(getCodingAgent(id)?.id).toBe(id);
    }
  });

  it("is undefined for an unknown id", () => {
    expect(getCodingAgent("aider")).toBeUndefined();
  });
});

describe("launchArgs", () => {
  it("claude passes the prompt with -p only in background", () => {
    expect(args("claude", INTERACTIVE)).toEqual([PROMPT]);
    expect(args("claude", INTERACTIVE_BYPASS)).toEqual([
      "--dangerously-skip-permissions",
      PROMPT,
    ]);
    expect(args("claude", BACKGROUND)).toEqual(["-p", PROMPT]);
    expect(args("claude", BACKGROUND_BYPASS)).toEqual([
      "-p",
      "--dangerously-skip-permissions",
      PROMPT,
    ]);
  });

  it("codex puts the exec subcommand before its bypass flag", () => {
    expect(args("codex", INTERACTIVE)).toEqual([PROMPT]);
    expect(args("codex", INTERACTIVE_BYPASS)).toEqual([
      "--dangerously-bypass-approvals-and-sandbox",
      PROMPT,
    ]);
    expect(args("codex", BACKGROUND)).toEqual(["exec", PROMPT]);

    const backgroundBypass = args("codex", BACKGROUND_BYPASS);
    expect(backgroundBypass).toEqual([
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      PROMPT,
    ]);
    // The flag is only accepted after the subcommand — order is the contract.
    expect(backgroundBypass.indexOf("exec")).toBeLessThan(
      backgroundBypass.indexOf("--dangerously-bypass-approvals-and-sandbox")
    );
  });

  it("opencode always runs `run`, background or not", () => {
    for (const mode of ALL_MODES) {
      expect(args("opencode", mode)[0]).toBe("run");
    }
    expect(args("opencode", INTERACTIVE)).toEqual(["run", PROMPT]);
    expect(args("opencode", BACKGROUND)).toEqual(["run", PROMPT]);
    expect(args("opencode", BACKGROUND_BYPASS)).toEqual([
      "run",
      "--dangerously-skip-permissions",
      PROMPT,
    ]);
  });

  it("cursor bypasses with --force", () => {
    expect(args("cursor", INTERACTIVE)).toEqual([PROMPT]);
    expect(args("cursor", INTERACTIVE_BYPASS)).toEqual(["--force", PROMPT]);
    expect(args("cursor", BACKGROUND)).toEqual(["-p", PROMPT]);
    expect(args("cursor", BACKGROUND_BYPASS)).toEqual([
      "-p",
      "--force",
      PROMPT,
    ]);
  });

  it("ends every argv with the prompt, in every mode", () => {
    for (const id of CODING_AGENT_IDS) {
      for (const mode of ALL_MODES) {
        expect(args(id, mode).at(-1)).toBe(PROMPT);
      }
    }
  });
});

describe("buildLaunchSpec", () => {
  const connection: Connection = {
    endpoint: "http://localhost:6006",
    projectName: "my-app",
  };

  it("launches the binary in the cwd with credentials in the environment", () => {
    const spec = buildLaunchSpec(agent("cursor"), {
      prompt: PROMPT,
      cwd: "/repo",
      connection: { ...connection, apiKey: "sk-test" },
      mode: BACKGROUND_BYPASS,
    });
    expect(spec).toEqual({
      command: "cursor-agent",
      args: ["-p", "--force", PROMPT],
      cwd: "/repo",
      env: {
        PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
        PHOENIX_PROJECT_NAME: "my-app",
        PHOENIX_API_KEY: "sk-test",
      },
    });
  });

  it("omits the API key when auth is off, and defaults to interactive mode", () => {
    const spec = buildLaunchSpec(agent("claude"), {
      prompt: PROMPT,
      cwd: "/repo",
      connection,
    });
    expect(spec.args).toEqual([PROMPT]);
    expect(spec.env).not.toHaveProperty("PHOENIX_API_KEY");
  });
});

describe("probeBinary", () => {
  it("passes a kill timeout through the exec seam", async () => {
    const { specs, processes } = recordingExec(0);
    expect(await probeBinary({ processes }, "claude")).toBe(true);
    expect(specs[0]?.args).toEqual(["--version"]);
    expect(specs[0]?.timeoutMs).toBeGreaterThan(0);
  });

  it("treats a non-zero exit (including a killed probe) as not found", async () => {
    const { processes } = recordingExec(1);
    expect(await probeBinary({ processes }, "claude")).toBe(false);
  });
});

describe("pathWithoutPackageBins", () => {
  it("drops node_modules/.bin entries and keeps the rest", () => {
    const pathValue = ["/usr/local/bin", PACKAGE_BIN, "/usr/bin"].join(
      path.delimiter
    );
    expect(pathWithoutPackageBins(pathValue)).toBe(
      ["/usr/local/bin", "/usr/bin"].join(path.delimiter)
    );
  });
});

describe("probeGlobalBinary", () => {
  it("probes with package bin dirs stripped from PATH", async () => {
    const { specs, processes } = recordingExec(127);
    const env = { PATH: ["/usr/local/bin", PACKAGE_BIN].join(path.delimiter) };
    expect(
      await probeGlobalBinary(
        { processes, context: fakeRunContext({ env }) },
        "px"
      )
    ).toBe(false);
    expect(specs[0]?.env?.PATH).toBe("/usr/local/bin");
  });

  it("probes with the ambient PATH untouched when none is set", async () => {
    const { specs, processes } = recordingExec(0);
    expect(
      await probeGlobalBinary({ processes, context: fakeRunContext() }, "px")
    ).toBe(true);
    expect(specs[0]?.env).toBeUndefined();
  });

  it("overrides PATH under the spelling the environment uses (Windows)", async () => {
    const { specs, processes } = recordingExec(127);
    // Windows spells it "Path". The override has to land on that key: the seam
    // merges it over a copy of the ambient environment, so overriding "PATH"
    // instead would leave the child with both, and the unfiltered one might win.
    const env = { Path: ["/usr/local/bin", PACKAGE_BIN].join(path.delimiter) };
    expect(
      await probeGlobalBinary(
        { processes, context: fakeRunContext({ env }) },
        "px"
      )
    ).toBe(false);
    expect(specs[0]?.env).toEqual({ Path: "/usr/local/bin" });
  });
});
