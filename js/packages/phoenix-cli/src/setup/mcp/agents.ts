/**
 * The coding agents `px setup mcp` can register the Phoenix remote MCP server
 * with, and how each one is configured per scope.
 *
 * This is a separate registry from the instrumentation one in
 * `../agents/registry.ts`. That registry is launch-focused — it knows how to
 * *run* an agent to instrument a repo, and only covers the four agents that can
 * take that hand-off. MCP configuration is a different concern (no launch, two
 * scopes, six agents including VS Code and Gemini), so it gets its own registry
 * rather than bloating the instrument one with fields it can't use.
 *
 * Each agent declares a per-scope {@link McpInstallAction}: `cli` where the
 * agent ships an `mcp add` subcommand (the installed binary writes the format
 * that same binary reads — it can never drift from the agent's own schema), and
 * `file` where the only documented mechanism is a config file we merge into.
 * The file shapes mirror `docs/phoenix/integrations/remote-mcp.mdx`, which is
 * the contract to keep them true to.
 */

import * as path from "node:path";

/** The name the Phoenix MCP server is registered under in every agent config. */
export const PHOENIX_MCP_SERVER_NAME = "phoenix";

export type McpAgentId =
  | "claude"
  | "codex"
  | "gemini"
  | "cursor"
  | "opencode"
  | "vscode";

export type McpScope = "global" | "local";

/** A single HTTP header to attach for the API-key bearer fallback. */
export interface McpHeader {
  name: string;
  value: string;
}

/** The filesystem facts an install needs to resolve its target path. */
export interface McpInstallContext {
  /** The user's home directory — where global configs live. */
  home: string;
  /** The repo root — where local (repo-scoped) configs live. */
  cwd: string;
}

/**
 * How one agent is configured for one scope.
 *
 * `cli` runs the agent's own `mcp add`; `removeArgs`/`verifyArgs` are optional
 * because not every agent ships a `remove`/`get` (Gemini and `code --add-mcp`
 * do not). When `verifyArgs` is absent the executor trusts the add's exit code;
 * when `removeArgs` is absent it cannot retry an add refused for already
 * existing, and reports the refusal instead.
 *
 * `file` merges a JSON fragment into a config file — absolute for a global
 * install (`~/.cursor/mcp.json`), repo-relative for a local one.
 */
export type McpInstallAction =
  | {
      kind: "cli";
      /** Binary that owns the config it writes. */
      binary: string;
      /** argv (after the binary) that registers the server. */
      addArgs: (url: string, headers: McpHeader[]) => string[];
      /** Best-effort removal to make a re-run idempotent when `add` refuses. */
      removeArgs?: string[];
      /** Read-back that confirms the entry actually landed. */
      verifyArgs?: string[];
      /**
       * The subset of `headers` this agent's `mcp add` cannot persist. Codex
       * stores only a bearer token via `--bearer-token-env-var`, so any other
       * header — or a bearer value that isn't `${VAR}`-shaped — would be
       * silently dropped, leaving a config that looks authenticated but isn't.
       * A non-empty result stops the run. Absent means every header is honored
       * (the raw `--header` agents).
       */
      droppedHeaders?: (headers: McpHeader[]) => McpHeader[];
    }
  | {
      kind: "file";
      /** Absolute path to the config file for this scope. */
      path: (ctx: McpInstallContext) => string;
      /** How that path reads in the report (repo-relative, or `~/…`). */
      displayPath: (ctx: McpInstallContext) => string;
      /** Keys applied only when the file is created (e.g. `$schema`). */
      createDefaults?: Record<string, unknown>;
      /** The JSON fragment to merge in. */
      patch: (url: string, headers: McpHeader[]) => Record<string, unknown>;
    };

export interface McpAgent {
  id: McpAgentId;
  /** "Claude Code", "Codex", … */
  label: string;
  /** Binary name for PATH detection. */
  binary: string;
  /**
   * Per-scope install. A scope absent from the map is unsupported by the agent
   * — Codex reads only a single global `~/.codex/config.toml`, so it has no
   * `local` entry, and the command says so when `--local` names it.
   */
  install: Partial<Record<McpScope, McpInstallAction>>;
}

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

/** `--header "Name: value"` pairs, for agents whose CLI takes raw headers. */
function headerFlags(headers: McpHeader[]): string[] {
  return headers.flatMap((header) => [
    "--header",
    `${header.name}: ${header.value}`,
  ]);
}

/** A `headers` object for file configs, or undefined when there are none. */
function headersObject(
  headers: McpHeader[]
): Record<string, string> | undefined {
  if (headers.length === 0) {
    return undefined;
  }
  return Object.fromEntries(
    headers.map((header) => [header.name, header.value])
  );
}

/**
 * The env-var name behind an `Authorization: Bearer ${VAR}` header, if the
 * value is exactly that shape. Codex's `mcp add` cannot store an arbitrary
 * header — only `--bearer-token-env-var` — so a bearer header aimed at Codex is
 * translated to the env var it references, and a literal token (no env
 * indirection) simply yields no bearer flag.
 */
function bearerTokenEnvVar(headers: McpHeader[]): string | undefined {
  const auth = headers.find(
    (header) => header.name.toLowerCase() === "authorization"
  );
  if (!auth) {
    return undefined;
  }
  const match = auth.value.match(/^Bearer\s+\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Per-agent install builders
// ---------------------------------------------------------------------------

/** Claude Code and Gemini share the same `mcp add` shape, only the scope
 *  flag differs. Both take `--scope user|project` and raw `--header`s. */
function httpCliAdd(
  binary: string,
  scopeFlag: "user" | "project",
  { verify }: { verify: boolean }
): McpInstallAction {
  return {
    kind: "cli",
    binary,
    addArgs: (url, headers) => [
      "mcp",
      "add",
      "--scope",
      scopeFlag,
      "--transport",
      "http",
      ...headerFlags(headers),
      PHOENIX_MCP_SERVER_NAME,
      url,
    ],
    removeArgs: [
      "mcp",
      "remove",
      "--scope",
      scopeFlag,
      PHOENIX_MCP_SERVER_NAME,
    ],
    ...(verify ? { verifyArgs: ["mcp", "get", PHOENIX_MCP_SERVER_NAME] } : {}),
  };
}

// ---------------------------------------------------------------------------
// File-config fragments
// ---------------------------------------------------------------------------

const OPENCODE_DEFAULTS = { $schema: "https://opencode.ai/config.json" };

function cursorPatch(
  url: string,
  headers: McpHeader[]
): Record<string, unknown> {
  return {
    mcpServers: {
      [PHOENIX_MCP_SERVER_NAME]: {
        url,
        ...(headersObject(headers) ? { headers: headersObject(headers) } : {}),
      },
    },
  };
}

function opencodePatch(
  url: string,
  headers: McpHeader[]
): Record<string, unknown> {
  return {
    mcp: {
      [PHOENIX_MCP_SERVER_NAME]: {
        type: "remote",
        url,
        enabled: true,
        ...(headersObject(headers) ? { headers: headersObject(headers) } : {}),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const MCP_AGENTS: readonly McpAgent[] = [
  {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    install: {
      // `--scope user` is user-wide; `--scope project` writes the shared
      // `.mcp.json` at the repo root (the "repo" scope a --local install means).
      global: httpCliAdd("claude", "user", { verify: true }),
      local: httpCliAdd("claude", "project", { verify: true }),
    },
  },
  {
    id: "codex",
    label: "Codex",
    binary: "codex",
    install: {
      // Codex reads one global `~/.codex/config.toml`; there is no repo-scoped
      // config, so only `global` is offered. `codex mcp add` writes the TOML
      // itself, so we never format TOML by hand.
      global: {
        kind: "cli",
        binary: "codex",
        addArgs: (url, headers) => {
          const envVar = bearerTokenEnvVar(headers);
          return [
            "mcp",
            "add",
            PHOENIX_MCP_SERVER_NAME,
            "--url",
            url,
            ...(envVar ? ["--bearer-token-env-var", envVar] : []),
          ];
        },
        removeArgs: ["mcp", "remove", PHOENIX_MCP_SERVER_NAME],
        verifyArgs: ["mcp", "get", PHOENIX_MCP_SERVER_NAME],
        droppedHeaders: (headers) => {
          // Codex persists only the bearer env var derived from a matching
          // Authorization header; every other header — and an Authorization
          // header whose value isn't `Bearer ${VAR}` — is discarded by
          // `codex mcp add`, so report those as un-storable.
          const honorsAuth = bearerTokenEnvVar(headers) !== undefined;
          return headers.filter(
            (header) =>
              !(honorsAuth && header.name.toLowerCase() === "authorization")
          );
        },
      },
    },
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    binary: "gemini",
    install: {
      // Gemini's `mcp add` mirrors Claude's flags but ships no `get`, so there
      // is no read-back — the add's exit code is trusted.
      global: httpCliAdd("gemini", "user", { verify: false }),
      local: httpCliAdd("gemini", "project", { verify: false }),
    },
  },
  {
    id: "cursor",
    label: "Cursor",
    binary: "cursor-agent",
    install: {
      global: {
        kind: "file",
        path: (ctx) => path.join(ctx.home, ".cursor", "mcp.json"),
        displayPath: () => "~/.cursor/mcp.json",
        patch: cursorPatch,
      },
      local: {
        kind: "file",
        path: (ctx) => path.join(ctx.cwd, ".cursor", "mcp.json"),
        displayPath: () => ".cursor/mcp.json",
        patch: cursorPatch,
      },
    },
  },
  {
    id: "opencode",
    label: "OpenCode",
    binary: "opencode",
    install: {
      global: {
        kind: "file",
        path: (ctx) =>
          path.join(ctx.home, ".config", "opencode", "opencode.json"),
        displayPath: () => "~/.config/opencode/opencode.json",
        createDefaults: OPENCODE_DEFAULTS,
        patch: opencodePatch,
      },
      local: {
        kind: "file",
        path: (ctx) => path.join(ctx.cwd, "opencode.json"),
        displayPath: () => "opencode.json",
        createDefaults: OPENCODE_DEFAULTS,
        patch: opencodePatch,
      },
    },
  },
  {
    id: "vscode",
    label: "VS Code",
    binary: "code",
    install: {
      // Global: the user-profile `mcp.json` path is platform-specific, so we
      // let the `code` CLI write it rather than guessing the location.
      global: {
        kind: "cli",
        binary: "code",
        addArgs: (url, headers) => [
          "--add-mcp",
          JSON.stringify({
            name: PHOENIX_MCP_SERVER_NAME,
            type: "http",
            url,
            ...(headersObject(headers)
              ? { headers: headersObject(headers) }
              : {}),
          }),
        ],
      },
      // Local: the documented workspace file.
      local: {
        kind: "file",
        path: (ctx) => path.join(ctx.cwd, ".vscode", "mcp.json"),
        displayPath: () => ".vscode/mcp.json",
        patch: (url, headers) => ({
          servers: {
            [PHOENIX_MCP_SERVER_NAME]: {
              type: "http",
              url,
              ...(headersObject(headers)
                ? { headers: headersObject(headers) }
                : {}),
            },
          },
        }),
      },
    },
  },
];

/** The agent with this id, or undefined when the id is unknown. */
export function getMcpAgent(id: string): McpAgent | undefined {
  return MCP_AGENTS.find((agent) => agent.id === id);
}

/** Every id `--agent` accepts, for help text and error messages. */
export const MCP_AGENT_IDS: readonly McpAgentId[] = MCP_AGENTS.map(
  (agent) => agent.id
);
