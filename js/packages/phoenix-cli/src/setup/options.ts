/**
 * Input resolution for setup.
 *
 * Follows px's `resolveConfig()` precedence — flags, then env, then
 * defaults — additionally accepting `PHOENIX_COLLECTOR_ENDPOINT` and
 * `PHOENIX_PROJECT_NAME` as endpoint/project aliases (#14131). There are no
 * setup-specific env vars. Reads env only through `RunContext.env`.
 *
 * Note the `--no-input` flag (or a non-TTY stdin) — not the presence of env
 * vars — is what opts into headless behavior: an ambient `PHOENIX_API_KEY`
 * in a dev shell never silently short-circuits the interactive flow.
 */

import { CODING_AGENT_IDS, type CodingAgentId } from "./agents/registry";
import * as COPY from "./copy";
import type { DocsPrefetchOptions, RunContext } from "./deps";
import { HeadlessInputError } from "./errors";

/**
 * The parsed `px setup` flags, as the command layer hands them over. Every
 * choice setup would prompt for has a field here, which is what lets an
 * unattended caller — CI, or a coding agent — run the same flow a human
 * clicks through. Raw material for {@link resolveSetupInputs}; steps only
 * ever see the resolved {@link SetupInputs}.
 */
export interface SetupOptions {
  /** --endpoint: pre-answer the endpoint question */
  endpoint?: string;
  /** --project: name or Relay Global ID */
  project?: string;
  /** --no-input: headless mode (also auto-on when !stdin.isTTY, per px convention) */
  noInput?: boolean;
  /**
   * Hidden --api-url: base URL for setup's own API calls (dev).
   * User-facing values — hand-off files, px profile, traces URLs — keep the
   * endpoint the user chose.
   */
  apiUrl?: string;
  /**
   * --agent: pre-answer the instrumentation lane with a coding agent id.
   * Validated against the registry at the command layer. Headless
   * instrumentation requires it — there is no prompt to fall back to.
   */
  agent?: CodingAgentId;
  /**
   * --language: languages to instrument. Passed to the agent so it skips its
   * own detection; empty means "detect it yourself".
   */
  languages?: string[];
  /**
   * --instrument / --no-instrument: run the instrumentation hand-off.
   * Undefined means "decide by lane" — interactive asks, headless skips
   * (registration-only stays the default for an unattended run, so `px setup
   * --no-input` in CI never edits source that nobody asked it to touch).
   */
  instrument?: boolean;
  /** --skills / --no-skills: offer the coding-agent skills install. */
  skills?: boolean;
  /**
   * --yolo: let the agent run without its own permission prompts. Required in
   * practice for a background run, which has no terminal to approve on.
   */
  bypassPermissions?: boolean;
  /**
   * --background: run the agent to completion without its TUI. Implied when
   * setup itself is headless — there is no terminal to hand over.
   */
  background?: boolean;
  /** Docs prefetch, so the agent instruments against local docs. */
  docs?: DocsPrefetchOptions;
  /**
   * --docs-mcp / --no-docs-mcp: connect the Phoenix docs MCP server to the
   * coding agent's project config (replaces the docs prefetch when taken).
   * Undefined means ask interactively; headless skips unless the flag opts in.
   */
  docsMcp?: boolean;
}

export interface SetupInputs {
  /** Pre-answered endpoint (flag, else env), if any. */
  endpoint?: string;
  /** Pre-answered project name or Relay Global ID (flag, else env), if any. */
  project?: string;
  /** API key from env — used by the headless auth-on lane only. */
  apiKey?: string;
  /** True when --no-input was passed or stdin is not a TTY. */
  headless: boolean;
  /** Pre-answered instrumentation lane, if `--agent` named one. */
  agent?: CodingAgentId;
  /** Languages to instrument; empty means the agent detects them itself. */
  languages: string[];
  /**
   * Whether to run the instrumentation hand-off. Interactive defaults to
   * true (it is the point of setup); headless defaults to false, so an
   * unattended run registers without ever editing source unless asked.
   */
  instrument: boolean;
  /** Whether to offer/install the coding-agent skills; undefined means ask. */
  skills?: boolean;
  /** Run the agent without its TUI. Always true when setup is headless. */
  background: boolean;
  /** Run the agent without its own permission prompts (`--yolo`). */
  bypassPermissions: boolean;
  /** Docs prefetch; only consulted when `instrument` is true. */
  docs: DocsPrefetchOptions;
  /**
   * Docs MCP offer; only consulted when `instrument` is true. Undefined means
   * ask interactively — an unattended run skips it unless `--docs-mcp` opts in.
   */
  docsMcp?: boolean;
}

/**
 * A headless run that instruments must name its agent: there is no prompt to
 * pick a lane from, and silently falling back to one would be a coin flip over
 * which agent edits the caller's source.
 *
 * `px setup instrument` calls this directly — its lane is instrumentation by
 * definition, so it never passes `--instrument` for `resolveSetupInputs` to
 * catch.
 */
export function assertAgentForHeadlessInstrument({
  headless,
  agent,
}: {
  headless: boolean;
  agent?: CodingAgentId;
}): void {
  if (headless && agent === undefined) {
    throw new HeadlessInputError(COPY.HEADLESS.agentRequired(CODING_AGENT_IDS));
  }
}

export function resolveSetupInputs({
  options,
  context,
}: {
  options: SetupOptions;
  context: Pick<RunContext, "env" | "stdinIsTTY">;
}): SetupInputs {
  const { env } = context;
  const endpoint =
    options.endpoint ??
    env.PHOENIX_HOST ??
    env.PHOENIX_COLLECTOR_ENDPOINT ??
    undefined;
  const project =
    options.project ??
    env.PHOENIX_PROJECT ??
    env.PHOENIX_PROJECT_NAME ??
    undefined;
  const apiKey = env.PHOENIX_API_KEY ?? undefined;
  const headless = Boolean(options.noInput) || !context.stdinIsTTY;

  // Interactive setup exists to instrument; an unattended run does not
  // touch source unless the caller asked for it by name.
  const instrument = options.instrument ?? !headless;

  if (instrument) {
    assertAgentForHeadlessInstrument({ headless, agent: options.agent });
  }

  return {
    endpoint: endpoint?.trim() || undefined,
    project: project?.trim() || undefined,
    apiKey: apiKey?.trim() || undefined,
    headless,
    agent: options.agent,
    languages: options.languages ?? [],
    instrument,
    skills: options.skills,
    // A headless run has no terminal to hand to the agent's TUI.
    background: options.background ?? headless,
    bypassPermissions: Boolean(options.bypassPermissions),
    docs: options.docs ?? { enabled: true },
    docsMcp: options.docsMcp,
  };
}
