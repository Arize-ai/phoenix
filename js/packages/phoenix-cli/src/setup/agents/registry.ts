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

/** The server name the docs MCP is registered under in agent configs. */
export const DOCS_MCP_SERVER_NAME = "phoenix-docs";

/**
 * The Mintlify-hosted Phoenix docs MCP server (streamable HTTP). Searching it
 * returns just the relevant doc sections, so an agent connected to it needs
 * neither the `.px/docs` download nor whole-page fetches.
 */
export const DOCS_MCP_SERVER_URL = "https://arizeai-433a7140.mintlify.app/mcp";

/**
 * How the docs MCP server is installed for an agent, scoped to the repo setup
 * runs in. Absent when the agent has no per-project MCP config (Codex reads
 * only a global TOML).
 *
 * `cli` is preferred wherever the agent ships an MCP subcommand: the installed
 * binary writes the config format that same binary reads, so the CLI can never
 * drift from the agent's schema. `file` is the fallback for agents whose only
 * documented mechanism is hand-editing a JSON file — those shapes mirror
 * `docs/phoenix/integrations/phoenix-mcp-server.mdx`, which is the contract to
 * keep them true to.
 */
export type DocsMcpInstall =
  | {
      kind: "cli";
      /**
       * Best-effort removal of a previous entry, with its exit code ignored.
       * Run only after an `add` was refused and `verifyArgs` confirmed an
       * entry exists under our name — `add` refuses a name that already
       * exists, and remove-then-retry is what makes a setup re-run
       * idempotent, while removing any earlier would destroy a working
       * registration a failed retry can't put back.
       */
      removeArgs: string[];
      /** argv (after the binary) that registers the server. */
      addArgs(serverUrl: string): string[];
      /**
       * Read-back of the entry after `add`; a non-zero exit means the server
       * is not actually registered. This is the drift guard: if the agent's
       * flags ever change meaning while still parsing, exit codes alone would
       * lie, but an entry that doesn't show up in the agent's own listing
       * cannot.
       */
      verifyArgs: string[];
    }
  | {
      kind: "file";
      /**
       * Config file path, relative to the repo root. Always forward-slash:
       * Node's fs resolves it on every platform, and the setup report stays
       * platform-stable (`path.join` would put a backslash in the JSON
       * envelope on Windows).
       */
      relativePath: string;
      /** Keys applied only when the file is being created, e.g. `$schema`. */
      createDefaults?: Record<string, unknown>;
      /** The JSON fragment to merge into that file. */
      patch(serverUrl: string): Record<string, unknown>;
    };

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
  /** See {@link DocsMcpInstall}; absent when the agent has none. */
  docsMcpInstall?: DocsMcpInstall;
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
    // The default (local) scope is deliberate: nothing lands in the repo, and
    // unlike a project-scoped .mcp.json the server needs no first-use
    // approval, so the launched hand-off session can actually use it.
    docsMcpInstall: {
      kind: "cli",
      removeArgs: ["mcp", "remove", DOCS_MCP_SERVER_NAME],
      addArgs: (serverUrl) => [
        "mcp",
        "add",
        "--transport",
        "http",
        DOCS_MCP_SERVER_NAME,
        serverUrl,
      ],
      verifyArgs: ["mcp", "get", DOCS_MCP_SERVER_NAME],
    },
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
    docsMcpInstall: {
      kind: "file",
      relativePath: "opencode.json",
      createDefaults: { $schema: "https://opencode.ai/config.json" },
      patch: (serverUrl) => ({
        mcp: {
          [DOCS_MCP_SERVER_NAME]: {
            type: "remote",
            url: serverUrl,
            enabled: true,
          },
        },
      }),
    },
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
    docsMcpInstall: {
      kind: "file",
      relativePath: ".cursor/mcp.json",
      patch: (serverUrl) => ({
        mcpServers: { [DOCS_MCP_SERVER_NAME]: { url: serverUrl } },
      }),
    },
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

/** The agents whose binary probe succeeds, in the given order. */
export async function detectAgents<TAgent extends { binary: string }>(
  deps: Pick<SetupDeps, "processes">,
  agents: readonly TAgent[]
): Promise<TAgent[]> {
  const probes = await Promise.all(
    agents.map((agent) => probeBinary(deps, agent.binary))
  );
  return agents.filter((_, index) => probes[index]);
}

/** Agents whose binary probe succeeds, in registry order. */
export function detectCodingAgents(
  deps: Pick<SetupDeps, "processes">
): Promise<CodingAgent[]> {
  return detectAgents(deps, CODING_AGENTS);
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
