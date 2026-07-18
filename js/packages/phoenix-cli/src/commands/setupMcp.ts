/**
 * `px setup mcp` — register the Phoenix remote MCP server (`<endpoint>/mcp`)
 * with a coding agent.
 *
 * A slice of the `px setup` flow (a deliberate non-noun-verb special, like
 * `px setup instrument`). The endpoint is inferred through `resolveConfig` —
 * the same flag → env → profile → default merge every `px` command uses — so
 * the user never re-types their Phoenix URL. Auth is OAuth by default (URL-only
 * config; the agent opens Phoenix's browser login on first use); `--header`
 * wires the API-key bearer fallback for headless clients.
 *
 * All behavior lives behind `runSetupMcp` in `../setup/mcp/runSetupMcp.ts`;
 * this layer only parses flags, resolves the endpoint, and renders the report.
 */

import { Command } from "commander";

import { resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeOutput } from "../io";
import { collectString } from "../optionParsers";
import * as COPY from "../setup/copy";
import { buildDefaultDeps } from "../setup/deps/buildDefaultDeps";
import {
  HeadlessInputError,
  SetupCancelledError,
  SetupFatalError,
} from "../setup/errors";
import {
  MCP_AGENT_IDS,
  type McpAgentId,
  type McpHeader,
  type McpScope,
} from "../setup/mcp/agents";
import { runSetupMcp } from "../setup/mcp/runSetupMcp";
import { writeStructuredError } from "../structuredError";
import { ENDPOINT_REQUIREMENT, isEndpointUrl } from "../validation/endpoint";
import { formatMcpSetupOutput, type OutputFormat } from "./formatSetup";

/** The typed mirror of the flags `px setup mcp` registers. */
interface SetupMcpCommandOptions {
  /**
   * `--agent <agent>`: Coding agent to configure. Required headlessly (no
   * prompt to fall back to); interactively, omitting it opens the agent picker.
   *
   * @example "codex"
   */
  agent?: string;
  /**
   * `--global`: Configure the server in the agent's user-wide config (the
   * default when neither scope flag is passed headlessly).
   *
   * @example true
   */
  global?: boolean;
  /**
   * `--local`: Configure the server in this repo's config (requires a git
   * repository). Codex has no repo-scoped config and stays global.
   *
   * @example true
   */
  local?: boolean;
  /**
   * `--endpoint <url>`: Phoenix base URL. Overrides the active profile and
   * `PHOENIX_HOST`; when omitted the endpoint is inferred and (interactively)
   * confirmable.
   *
   * @example "https://phoenix.example.com"
   */
  endpoint?: string;
  /**
   * `--profile <name>`: Named profile to infer the endpoint from.
   *
   * @example "prod"
   */
  profile?: string;
  /**
   * `--header <header>`: `Name: value` header to attach for the API-key bearer
   * fallback (repeatable). Without it the config is URL-only (OAuth).
   *
   * @example ["Authorization: Bearer ${PHOENIX_API_KEY}"]
   */
  header?: string[];
  /**
   * `--no-input`: Headless mode. Reads inverted — Commander defaults it to
   * `true` and sets `false` only when `--no-input` is passed. Headless requires
   * `--agent` and defaults the scope to global.
   *
   * @example false // px setup mcp --agent codex --no-input
   */
  input?: boolean;
  /**
   * `--format <format>`: How the result is rendered — `pretty` (default),
   * `json`, or `raw`.
   *
   * @example "raw"
   */
  format?: OutputFormat;
}

const OUTPUT_FORMATS: readonly OutputFormat[] = ["pretty", "json", "raw"];

/** Parse `Name: value` into a header, or throw with the offending input. */
function parseHeader(raw: string): McpHeader {
  const index = raw.indexOf(":");
  const name = index === -1 ? "" : raw.slice(0, index).trim();
  const value = index === -1 ? "" : raw.slice(index + 1).trim();
  if (!name || !value) {
    throw new HeadlessInputError(
      `Invalid --header "${raw}". Use the form "Name: value".`
    );
  }
  return { name, value };
}

/** Reject bad flag values before any side effect runs. */
function toMcpInputs(options: SetupMcpCommandOptions): {
  agent?: McpAgentId;
  scope?: McpScope;
  headers: McpHeader[];
  endpointExplicit: boolean;
  headless: boolean;
} {
  const format = options.format ?? "pretty";
  if (!OUTPUT_FORMATS.includes(format)) {
    fail(
      format,
      `Invalid --format: ${options.format}.`,
      "px setup mcp --format pretty|json|raw"
    );
  }
  if (
    options.agent !== undefined &&
    !MCP_AGENT_IDS.includes(options.agent as McpAgentId)
  ) {
    fail(
      format,
      `Invalid --agent: ${options.agent}.`,
      `px setup mcp --agent <${MCP_AGENT_IDS.join("|")}>`
    );
  }
  if (options.global && options.local) {
    fail(
      format,
      "Pass only one of --global or --local.",
      "px setup mcp --global"
    );
  }
  if (options.endpoint !== undefined && !isEndpointUrl(options.endpoint)) {
    fail(format, `--endpoint ${ENDPOINT_REQUIREMENT}.`, undefined);
  }

  let headers: McpHeader[];
  try {
    headers = (options.header ?? []).map(parseHeader);
  } catch (error) {
    fail(
      format,
      error instanceof Error ? error.message : String(error),
      `px setup mcp --header "Authorization: Bearer \${PHOENIX_API_KEY}"`
    );
  }

  return {
    agent: options.agent as McpAgentId | undefined,
    scope: options.local ? "local" : options.global ? "global" : undefined,
    headers,
    endpointExplicit: options.endpoint !== undefined,
    headless: options.input === false,
  };
}

/** Emit a structured INVALID_ARGUMENT and exit — the one bad-flag exit path. */
function fail(format: OutputFormat, message: string, hint?: string): never {
  writeStructuredError({
    format,
    message,
    code: "INVALID_ARGUMENT",
    ...(hint ? { hint } : {}),
  });
  process.exit(ExitCode.INVALID_ARGUMENT);
}

/**
 * The command's single failure funnel, so a cancelled prompt, a bad headless
 * invocation, and a fatal install each keep their distinct exit code and give
 * `--format json|raw` callers the same `{error, code, hint}` envelope as the
 * rest of `px`.
 */
function exitWithError(error: unknown, format: OutputFormat): never {
  if (error instanceof SetupCancelledError) {
    writeStructuredError({
      format,
      message: COPY.CANCEL_OUTRO,
      code: "CANCELLED",
    });
    process.exit(ExitCode.CANCELLED);
  }
  if (error instanceof HeadlessInputError) {
    writeStructuredError({
      format,
      message: error.message,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (error instanceof SetupFatalError) {
    writeStructuredError({ format, message: error.message, code: "FAILURE" });
    process.exit(ExitCode.FAILURE);
  }
  const exitCode = getExitCodeForError(error);
  writeStructuredError({
    format,
    message: String(error),
    code: exitCode === ExitCode.NETWORK_ERROR ? "NETWORK_ERROR" : "FAILURE",
  });
  process.exit(exitCode);
}

async function setupMcpHandler(options: SetupMcpCommandOptions): Promise<void> {
  const format = options.format ?? "pretty";
  const parsed = toMcpInputs(options);
  const deps = buildDefaultDeps();

  // The endpoint is resolved the same way every command resolves it: flags
  // over the active profile, then env vars, then the built-in default.
  const config = resolveConfig({
    cliOptions: { endpoint: options.endpoint },
    profileName: options.profile,
  });
  // `--no-input` OR a non-TTY stdin opts into headless, matching px convention.
  const headless = parsed.headless || !deps.context.stdinIsTTY;

  try {
    const report = await runSetupMcp(deps, {
      endpoint: config.endpoint ?? "http://localhost:6006",
      endpointExplicit: parsed.endpointExplicit,
      agent: parsed.agent,
      scope: parsed.scope,
      headers: parsed.headers,
      headless,
    });
    // An interactive run already narrated the result through the prompter; only
    // a headless run (or an explicit --format) needs the printed report.
    if (headless || format !== "pretty") {
      writeOutput({ message: formatMcpSetupOutput({ report, format }) });
    }
    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    exitWithError(error, format);
  }
}

export function createSetupMcpCommand(): Command {
  const command = new Command("mcp");
  command
    .description(
      "Register the Phoenix remote MCP server with a coding agent.\n" +
        "The endpoint is inferred from --endpoint, the active profile, or PHOENIX_HOST."
    )
    .option(
      "--agent <agent>",
      `Coding agent to configure (${MCP_AGENT_IDS.join("|")})`
    )
    .option("--global", "Configure the agent's user-wide config (default)")
    .option("--local", "Configure this repo's config (requires a git repo)")
    .option("--endpoint <url>", "Phoenix base URL (skips inference)")
    .option("--profile <name>", "Profile to infer the endpoint from")
    .option(
      "--header <header>",
      'Header for the API-key fallback, "Name: value" (repeatable)',
      collectString,
      [] as string[]
    )
    .option("--no-input", "Headless mode: no prompts (requires --agent)")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .action(setupMcpHandler)
    .addHelpText(
      "after",
      `
Examples:
  px setup mcp
  px setup mcp --agent codex
  px setup mcp --agent claude --local
  px setup mcp --agent cursor --global --endpoint https://phoenix.example.com
  px setup mcp --agent codex --no-input --format raw
  px setup mcp --agent claude --header "Authorization: Bearer \${PHOENIX_API_KEY}"
`
    );
  return command;
}
