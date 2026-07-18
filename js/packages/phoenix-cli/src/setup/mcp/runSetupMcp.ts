/**
 * `px setup mcp` — register the Phoenix remote MCP server with a coding agent.
 *
 * Phoenix serves an MCP endpoint at `<base-url>/mcp`; this lane wires that URL
 * into a coding agent's config so the agent can search, query, and operate on
 * Phoenix data. The base URL is inferred by the command layer from the same
 * sources every `px` command uses (flag → env → active profile → default), so
 * the user never re-types it — this module receives the resolved endpoint.
 *
 * Auth is OAuth by default: the config is URL-only and the agent opens Phoenix's
 * built-in browser login on first use. `--header` supplies the API-key bearer
 * fallback for headless clients, and each agent applies it in its own way
 * (see {@link ./agents}).
 *
 * The bare command (no `--agent`) walks two prompts — scope, then agent — with
 * the endpoint shown (and, unless pinned by `--endpoint`, confirmable) first. A
 * headless run must name its agent and takes global scope by default.
 */

import { isEndpointUrl, normalizeEndpoint } from "../../validation/endpoint";
import { probeBinary } from "../agents/registry";
import type { SetupDeps } from "../deps";
import { HeadlessInputError, SetupFatalError } from "../errors";
import {
  getMcpAgent,
  MCP_AGENTS,
  MCP_AGENT_IDS,
  PHOENIX_MCP_SERVER_NAME,
  type McpAgent,
  type McpAgentId,
  type McpHeader,
  type McpScope,
} from "./agents";
import { runMcpInstall } from "./install";

/** What a run did, in the shape the summary and `--format json` print. */
export interface McpSetupReport {
  /** The Phoenix base URL the server was pointed at (no trailing `/mcp`). */
  endpoint: string;
  /** The full MCP URL written into the agent config. */
  url: string;
  serverName: string;
  agent: McpAgentId;
  scope: McpScope;
  /** `oauth` when URL-only; `header` when a bearer/custom header was written. */
  auth: "oauth" | "header";
  /** The config file written, for file-based agents (repo-relative or `~/…`). */
  file?: string;
}

export interface McpSetupInputs {
  /** Resolved Phoenix base URL (normalized, no trailing slash). */
  endpoint: string;
  /** True when `--endpoint` pinned it — skips the interactive confirm prompt. */
  endpointExplicit: boolean;
  /** Pinned agent, or undefined to detect + prompt. */
  agent?: McpAgentId;
  /** Pinned scope, or undefined (interactive prompts; headless defaults global). */
  scope?: McpScope;
  /** Headers for the bearer fallback; empty means OAuth (URL only). */
  headers: McpHeader[];
  headless: boolean;
}

export const COPY = {
  endpointPrompt: "Phoenix endpoint",
  endpointInvalid:
    "Enter a full http:// or https:// URL (e.g. http://localhost:6006).",
  usingEndpoint: (url: string) =>
    `Registering the Phoenix MCP server at ${url}`,
  scopePrompt: "Where should the MCP server be configured?",
  scopeGlobalLabel: "Global",
  scopeGlobalHint: "available across all your projects",
  scopeLocalLabel: "This repo",
  scopeLocalHint: "written into this project's config, checked in with it",
  agentPrompt: "Which coding agent?",
  detectedHint: "detected",
  headlessNeedsAgent: `--agent is required with --no-input. Pass one of: ${MCP_AGENT_IDS.join(", ")}.`,
  localNeedsRepo:
    "--local must run inside a git repository. Re-run from your project, or use --global.",
  codexGlobalOnly:
    "Codex reads only a global config, so it is always configured globally.",
  codexGlobalOnlyHeadless:
    "Codex has no repo-scoped config. Drop --local (Codex is always global).",
  scopeUnsupported: (agentLabel: string, scope: McpScope) =>
    `${agentLabel} does not support ${scope} MCP configuration.`,
  configuredCli: (agentLabel: string) =>
    `Registered the Phoenix MCP server with ${agentLabel}.`,
  configuredFile: (agentLabel: string, file: string) =>
    `Wrote the Phoenix MCP server to ${file} for ${agentLabel}.`,
  installFailed: (agentLabel: string, reason: string) =>
    `Could not configure ${agentLabel}: ${reason}`,
  nextStepOAuth: (agentLabel: string) =>
    `Open ${agentLabel} and run /mcp (or use the ${PHOENIX_MCP_SERVER_NAME} server) — it will open a browser to log in to Phoenix on first use.`,
  nextStepHeader:
    "The server is configured with your bearer header — no browser login needed.",
} as const;

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export async function runSetupMcp(
  deps: Pick<SetupDeps, "context" | "prompter" | "processes">,
  inputs: McpSetupInputs
): Promise<McpSetupReport> {
  const endpoint = await resolveEndpoint(deps, inputs);
  const url = `${endpoint}/mcp`;

  const scope = await resolveScope(deps, inputs);
  const agent = await resolveAgent(deps, inputs);
  const effectiveScope = await reconcileScope(deps, agent, scope, inputs);

  if (effectiveScope === "local") {
    await assertGitRepo(deps);
  }

  const action = agent.install[effectiveScope];
  if (!action) {
    // Guarded by reconcileScope for the codex case; this is the belt-and-braces
    // guard for any future agent/scope gap.
    throw new SetupFatalError(
      COPY.scopeUnsupported(agent.label, effectiveScope)
    );
  }

  const installContext = {
    home: resolveHome(deps),
    cwd: deps.context.cwd,
  };
  const result = await runMcpInstall(deps, {
    action,
    url,
    headers: inputs.headers,
    installContext,
  });
  if (result.outcome === "failed") {
    throw new SetupFatalError(
      COPY.installFailed(agent.label, result.reason ?? "unknown error")
    );
  }

  const auth = inputs.headers.length > 0 ? "header" : "oauth";
  if (!inputs.headless) {
    deps.prompter.line(
      result.file
        ? COPY.configuredFile(agent.label, result.file)
        : COPY.configuredCli(agent.label)
    );
    deps.prompter.line(
      auth === "oauth" ? COPY.nextStepOAuth(agent.label) : COPY.nextStepHeader
    );
  }

  return {
    endpoint,
    url,
    serverName: PHOENIX_MCP_SERVER_NAME,
    agent: agent.id,
    scope: effectiveScope,
    auth,
    ...(result.file ? { file: result.file } : {}),
  };
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

async function resolveEndpoint(
  deps: Pick<SetupDeps, "prompter">,
  inputs: McpSetupInputs
): Promise<string> {
  // Headless, or endpoint pinned by flag: take the resolved value as-is.
  if (inputs.headless || inputs.endpointExplicit) {
    return normalizeEndpoint(inputs.endpoint);
  }
  // Interactive: show the inferred endpoint as the default and let the user
  // accept it (Enter) or point somewhere else.
  const entered = await deps.prompter.textInput({
    message: COPY.endpointPrompt,
    defaultValue: inputs.endpoint,
    validate: (value) =>
      isEndpointUrl(value) ? undefined : COPY.endpointInvalid,
  });
  const endpoint = normalizeEndpoint(entered);
  deps.prompter.line(COPY.usingEndpoint(`${endpoint}/mcp`));
  return endpoint;
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

async function resolveScope(
  deps: Pick<SetupDeps, "prompter">,
  inputs: McpSetupInputs
): Promise<McpScope> {
  if (inputs.scope) {
    return inputs.scope;
  }
  // Headless defaults to global — the safe, agent-agnostic choice, and the one
  // scope every agent supports.
  if (inputs.headless) {
    return "global";
  }
  return deps.prompter.select<McpScope>({
    message: COPY.scopePrompt,
    options: [
      {
        value: "global",
        label: COPY.scopeGlobalLabel,
        hint: COPY.scopeGlobalHint,
      },
      {
        value: "local",
        label: COPY.scopeLocalLabel,
        hint: COPY.scopeLocalHint,
      },
    ],
  });
}

/**
 * Codex has no repo-scoped config. When `local` names it, a headless run errors
 * (they pinned a scope the agent can't honor), while an interactive run says so
 * and falls back to global rather than dead-ending.
 */
async function reconcileScope(
  deps: Pick<SetupDeps, "prompter">,
  agent: McpAgent,
  scope: McpScope,
  inputs: McpSetupInputs
): Promise<McpScope> {
  if (agent.install[scope]) {
    return scope;
  }
  if (scope === "local" && agent.install.global) {
    if (inputs.headless) {
      throw new HeadlessInputError(COPY.codexGlobalOnlyHeadless);
    }
    deps.prompter.line(COPY.codexGlobalOnly);
    return "global";
  }
  throw new SetupFatalError(COPY.scopeUnsupported(agent.label, scope));
}

async function assertGitRepo(
  deps: Pick<SetupDeps, "context" | "processes">
): Promise<void> {
  const check = await deps.processes.exec({
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"],
    cwd: deps.context.cwd,
  });
  const isRepo = check.exitCode === 0 && check.stdout.trim() === "true";
  if (!isRepo) {
    // Same class either mode: it's a bad invocation, not a runtime failure.
    throw new HeadlessInputError(COPY.localNeedsRepo);
  }
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

async function resolveAgent(
  deps: Pick<SetupDeps, "prompter" | "processes">,
  inputs: McpSetupInputs
): Promise<McpAgent> {
  if (inputs.agent) {
    const agent = getMcpAgent(inputs.agent);
    if (!agent) {
      // Unreachable: the command layer validates --agent against MCP_AGENT_IDS.
      throw new HeadlessInputError(COPY.headlessNeedsAgent);
    }
    return agent;
  }
  if (inputs.headless) {
    throw new HeadlessInputError(COPY.headlessNeedsAgent);
  }

  const detected = await detectMcpAgents(deps);
  const detectedIds = new Set(detected.map((agent) => agent.id));
  // Detected agents first (with a hint), then the rest — so a user can still
  // configure an agent whose binary isn't on PATH (e.g. the VS Code app without
  // the `code` shell command).
  const ordered = [
    ...MCP_AGENTS.filter((agent) => detectedIds.has(agent.id)),
    ...MCP_AGENTS.filter((agent) => !detectedIds.has(agent.id)),
  ];
  const chosen = await deps.prompter.select<McpAgentId>({
    message: COPY.agentPrompt,
    options: ordered.map((agent) => ({
      value: agent.id,
      label: agent.label,
      ...(detectedIds.has(agent.id) ? { hint: COPY.detectedHint } : {}),
    })),
  });
  // `chosen` is one of MCP_AGENTS' ids by construction.
  return getMcpAgent(chosen)!;
}

/** Agents whose binary answers `--version`, in registry order. */
async function detectMcpAgents(
  deps: Pick<SetupDeps, "processes">
): Promise<McpAgent[]> {
  const probes = await Promise.all(
    MCP_AGENTS.map((agent) => probeBinary(deps, agent.binary))
  );
  return MCP_AGENTS.filter((_, index) => probes[index]);
}

/** The user's home directory, read only through the run context's env copy. */
function resolveHome(deps: Pick<SetupDeps, "context">): string {
  const { env } = deps.context;
  return env.HOME ?? env.USERPROFILE ?? "";
}
