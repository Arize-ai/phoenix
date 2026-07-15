/**
 * Known coding agents setup can hand off to.
 *
 * Detection is a parallel `<binary> --version` probe — binary-on-PATH is the
 * only signal, and a detected agent becomes a "Hand off to …" lane in the
 * instrumentation step. Launching is interactive: the agent takes over the
 * terminal with the setup prompt pre-loaded and Phoenix credentials injected
 * via environment variables; setup resumes when it exits.
 */

import * as path from "node:path";

import type { CommandSpec, SetupDeps } from "../deps";
import type { Connection } from "../steps/establishConnection";

export type CodingAgentId = "claude" | "codex" | "opencode" | "cursor";

/**
 * How the agent is run.
 *
 * `background` drops the TUI and runs to completion — required when setup
 * itself is headless, since there is no terminal for the agent to take over.
 * `bypassPermissions` waives the agent's own file/command approval prompts;
 * without it a background run stalls on the first approval it wants and is
 * killed by the verification timeout instead.
 */
export interface AgentRunMode {
  background: boolean;
  bypassPermissions: boolean;
}

export interface CodingAgent {
  id: CodingAgentId;
  /** "Claude Code", "Codex", … */
  label: string;
  /** Binary name for PATH discovery and launch. */
  binary: string;
  /**
   * argv that opens the agent with the prompt pre-loaded, in the requested
   * mode. Each agent builds its own argv because the flags are not
   * interchangeable and their order matters — `codex` takes its bypass flag
   * after the `exec` subcommand, not before it.
   */
  launchArgs(prompt: string, mode: AgentRunMode): string[];
}

export const CODING_AGENTS: readonly CodingAgent[] = [
  {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    launchArgs: (prompt, mode) => [
      ...(mode.background ? ["-p"] : []),
      ...(mode.bypassPermissions ? ["--dangerously-skip-permissions"] : []),
      prompt,
    ],
  },
  {
    id: "codex",
    label: "Codex",
    binary: "codex",
    // `codex exec` is the non-interactive entry point; flags belong after it.
    launchArgs: (prompt, mode) => [
      ...(mode.background ? ["exec"] : []),
      ...(mode.bypassPermissions
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : []),
      prompt,
    ],
  },
  {
    id: "opencode",
    label: "OpenCode",
    binary: "opencode",
    // `opencode run` is already non-interactive, so background adds nothing.
    launchArgs: (prompt, mode) => [
      "run",
      ...(mode.bypassPermissions ? ["--dangerously-skip-permissions"] : []),
      prompt,
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    binary: "cursor-agent",
    launchArgs: (prompt, mode) => [
      ...(mode.background ? ["-p"] : []),
      ...(mode.bypassPermissions ? ["--force"] : []),
      prompt,
    ],
  },
];

/** The agent with this id, or undefined when the id is unknown. */
export function getCodingAgent(id: string): CodingAgent | undefined {
  return CODING_AGENTS.find((agent) => agent.id === id);
}

/** Every id `--agent` accepts, for help text and error messages. */
export const CODING_AGENT_IDS: readonly CodingAgentId[] = CODING_AGENTS.map(
  (agent) => agent.id
);

const PROBE_TIMEOUT_MS = 2_000;

/**
 * True when the binary answers `--version` within the timeout. The timeout
 * kills the child (via the exec seam), so a hung probe counts as not found
 * without leaving an orphaned subprocess behind.
 */
export async function probeBinary(
  deps: Pick<SetupDeps, "processes">,
  binary: string,
  { env }: { env?: Record<string, string> } = {}
): Promise<boolean> {
  const result = await deps.processes.exec({
    command: binary,
    args: ["--version"],
    timeoutMs: PROBE_TIMEOUT_MS,
    ...(env ? { env } : {}),
  });
  return result.exitCode === 0;
}

/**
 * PATH with `node_modules/.bin` entries removed. Package runners (`npx`,
 * `pnpm dlx`) prepend their package's own bin directory, which would make a
 * package-provided shim masquerade as a globally installed binary.
 */
export function pathWithoutPackageBins(pathValue: string): string {
  const packageBinMarker = `node_modules${path.sep}.bin`;
  return pathValue
    .split(path.delimiter)
    .filter((entry) => !entry.includes(packageBinMarker))
    .join(path.delimiter);
}

/**
 * `probeBinary`, but blind to binaries provided by the running package —
 * used to decide whether `px` is genuinely installed globally when the
 * setup itself runs under `npx @arizeai/phoenix-cli`.
 */
export function probeGlobalBinary(
  deps: Pick<SetupDeps, "context" | "processes">,
  binary: string
): Promise<boolean> {
  // Override PATH under the spelling the run context resolved, so the child
  // does not end up with both a "Path" and a "PATH" on Windows.
  const { env, pathKey } = deps.context;
  const pathValue = env[pathKey];
  return probeBinary(
    deps,
    binary,
    pathValue === undefined
      ? {}
      : { env: { [pathKey]: pathWithoutPackageBins(pathValue) } }
  );
}

/** Agents whose binary probe succeeds, in registry order. */
export async function detectCodingAgents(
  deps: Pick<SetupDeps, "processes">
): Promise<CodingAgent[]> {
  const probes = await Promise.all(
    CODING_AGENTS.map((agent) => probeBinary(deps, agent.binary))
  );
  return CODING_AGENTS.filter((_, index) => probes[index]);
}

/**
 * Env vars the launched agent's shell inherits so the app under test can
 * export a verification trace without the agent handling credentials.
 */
export function connectionEnv(connection: Connection): Record<string, string> {
  return {
    PHOENIX_COLLECTOR_ENDPOINT: connection.endpoint,
    PHOENIX_PROJECT_NAME: connection.projectName,
    ...(connection.apiKey ? { PHOENIX_API_KEY: connection.apiKey } : {}),
  };
}

export function buildLaunchSpec(
  agent: CodingAgent,
  args: {
    prompt: string;
    cwd: string;
    connection: Connection;
    mode?: AgentRunMode;
  }
): CommandSpec {
  const mode = args.mode ?? { background: false, bypassPermissions: false };
  return {
    command: agent.binary,
    args: agent.launchArgs(args.prompt, mode),
    cwd: args.cwd,
    env: connectionEnv(args.connection),
  };
}
