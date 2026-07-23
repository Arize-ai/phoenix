/**
 * `px setup` — the agent-first onboarding flow.
 *
 * `setup` is a deliberate exception to the CLI's noun-verb rule —
 * onboarding is a flow, not a resource (precedent: `gh browse`-style
 * top-level specials). All behavior lives in `../setup/runSetup.ts` behind
 * the `SetupDeps` seam.
 *
 * The bare command runs the whole flow. Its slices are also re-runnable on
 * their own, so a repo that is already registered does not have to walk the
 * endpoint and connection questions again to instrument once more or install
 * the skills:
 *
 *   px setup instrument   # register (idempotent), instrument, verify traces
 *   px setup skills       # the coding-agent skills install alone
 */

import { Command } from "commander";

import { ExitCode } from "../exitCodes";
import { writeOutput } from "../io";
import { collectString, parsePositiveIntOption } from "../optionParsers";
import { CODING_AGENT_IDS, type CodingAgentId } from "../setup/agents/registry";
import type { SetupDeps } from "../setup/deps";
import { buildDefaultDeps } from "../setup/deps/buildDefaultDeps";
import {
  resolveSetupInputs,
  type SetupInputs,
  type SetupOptions,
} from "../setup/options";
import { runInstrument, runSetup, runSkills } from "../setup/runSetup";
import { writeStructuredError } from "../structuredError";
import { ENDPOINT_REQUIREMENT, isEndpointUrl } from "../validation/endpoint";
import { WORKERS_REQUIREMENT } from "./docs";
import {
  formatSetupOutput,
  formatToolingOutput,
  type OutputFormat,
} from "./formatSetup";
import { exitWithError } from "./setupErrors";
import { createSetupMcpCommand } from "./setupMcp";

/**
 * Options for `px setup` and its subcommands. Every choice setup would prompt
 * for has a flag here, which is what lets an unattended caller — CI, or a
 * coding agent — run the same flow a human clicks through.
 */
interface SetupCommandOptions {
  /**
   * `--endpoint <url>`: Phoenix endpoint to pre-answer the endpoint
   * question with, skipping that prompt.
   *
   * @example "http://localhost:6006"
   */
  endpoint?: string;
  /**
   * `--project <name>`: Phoenix project name or ID to pre-answer the
   * project question with.
   *
   * @example "my-app"
   */
  project?: string;
  /**
   * `--no-input`: Whether prompting is allowed, so it reads inverted from the
   * flag — Commander defaults it to `true` and sets it to `false` only when
   * `--no-input` is passed. When `false`, setup runs headlessly: it resolves
   * the connection, writes the hand-off files, and exits without instrumenting
   * unless `--instrument` says otherwise.
   *
   * @example false // px setup --no-input --endpoint http://localhost:6006
   */
  input?: boolean;
  /**
   * `--agent <agent>`: Coding agent to hand instrumentation to, skipping the
   * lane prompt. Required for a headless `--instrument` run, which has no
   * prompt to pick a lane from.
   *
   * @example "claude"
   */
  agent?: string;
  /**
   * `--language <language>`: Language(s) to instrument, repeatable. Passed to
   * the agent so it skips its own detection.
   *
   * @example ["python"]
   */
  language?: string[];
  /**
   * `--instrument` / `--no-instrument`: Run the instrumentation hand-off.
   * Defaults to on interactively (it is the point of setup) and off headlessly,
   * so an unattended `px setup` never edits source nobody asked it to touch.
   *
   * @example true // px setup --no-input --instrument --agent claude --yolo
   */
  instrument?: boolean;
  /**
   * `--skills` / `--no-skills`: Install the Phoenix coding-agent skills without
   * asking. Undefined leaves it as an interactive prompt.
   *
   * @example true
   */
  skills?: boolean;
  /**
   * `--background`: Run the agent to completion without its TUI. Implied by
   * `--no-input`, which has no terminal to hand over.
   *
   * @example true
   */
  background?: boolean;
  /**
   * `--yolo`: Let the agent apply its changes without asking permission. A
   * background agent has no terminal to ask on, so without this it stalls on
   * its first approval until trace verification times out.
   *
   * @example true
   */
  yolo?: boolean;
  /**
   * `--no-docs`: Skip the docs prefetch. Reads inverted (Commander defaults it
   * to `true`). Docs are only fetched on a run that instruments — they exist to
   * be read by the agent.
   *
   * @example false // px setup --no-docs
   */
  docs?: boolean;
  /**
   * `--docs-mcp` / `--no-docs-mcp`: Connect the Phoenix docs MCP server to the
   * coding agent taking the hand-off (via the agent's own `mcp` subcommand
   * when it has one, else its per-project config file); when taken, the docs
   * prefetch is skipped — the agent searches the docs on demand instead.
   * Undefined leaves it as an interactive prompt (headless runs then skip it).
   *
   * @example true // px setup --no-input --instrument --agent claude --docs-mcp --yolo
   */
  docsMcp?: boolean;
  /**
   * `--workflow <name>`: Docs workflow to prefetch, repeatable. Same values as
   * `px docs fetch`; defaults to that command's defaults.
   *
   * @example ["tracing"]
   */
  workflow?: string[];
  /**
   * `--refresh-docs`: Clear the docs output directory before downloading, so
   * pages dropped upstream don't linger.
   *
   * @example true
   */
  refreshDocs?: boolean;
  /**
   * `--workers <n>`: Concurrent docs downloads.
   *
   * @example 20
   */
  workers?: number;
  /**
   * `--format <format>`: How the result is rendered on stdout. `pretty` is the
   * human summary; `json`/`raw` emit the machine-readable report, including
   * whether traces were verified.
   *
   * @example "raw"
   */
  format?: OutputFormat;
  /**
   * `--api-url <url>`: Hidden dev-only override that routes setup's own API
   * calls to this origin instead of `endpoint`. Hand-off files and printed
   * trace URLs still use the `--endpoint` value the user chose. Validated
   * with `isEndpointUrl`.
   *
   * @example "http://localhost:6007"
   */
  apiUrl?: string;
}

function isCodingAgentId(value: string): value is CodingAgentId {
  return (CODING_AGENT_IDS as readonly string[]).includes(value);
}

/** Reject bad flag values before any side effect runs. */
function toSetupOptions(options: SetupCommandOptions): SetupOptions {
  const format = options.format ?? "pretty";
  if (options.apiUrl !== undefined && !isEndpointUrl(options.apiUrl)) {
    writeStructuredError({
      format,
      message: `--api-url ${ENDPOINT_REQUIREMENT}.`,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  let agent: CodingAgentId | undefined;
  if (options.agent !== undefined) {
    if (!isCodingAgentId(options.agent)) {
      writeStructuredError({
        format,
        message: `Invalid --agent: ${options.agent}.`,
        code: "INVALID_ARGUMENT",
        hint: `px setup --agent <${CODING_AGENT_IDS.join("|")}>`,
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
    agent = options.agent;
  }
  // `parsePositiveIntOption` yields NaN for a value a worker pool can't run on.
  if (Number.isNaN(options.workers)) {
    writeStructuredError({
      format,
      message: WORKERS_REQUIREMENT,
      code: "INVALID_ARGUMENT",
      hint: "px setup --workers 10",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  return {
    endpoint: options.endpoint,
    project: options.project,
    noInput: options.input === false,
    apiUrl: options.apiUrl,
    agent,
    languages: options.language,
    instrument: options.instrument,
    skills: options.skills,
    background: options.background,
    bypassPermissions: options.yolo,
    docs: {
      enabled: options.docs !== false,
      workflows: options.workflow,
      refresh: options.refreshDocs,
      workers: options.workers,
    },
    docsMcp: options.docsMcp,
  };
}

/**
 * Run one of the setup lanes, then print what it did in the requested format.
 *
 * Every lane goes through here, so the rule that a headless run always prints a
 * report — it has no interactive narration to fall back on — is stated once
 * instead of re-derived per subcommand.
 */
async function runLane<TReport>(
  commandOptions: SetupCommandOptions,
  lane: (deps: SetupDeps, inputs: SetupInputs) => Promise<TReport>,
  render: (report: TReport, format: OutputFormat) => string
): Promise<void> {
  const options = toSetupOptions(commandOptions);
  const format = commandOptions.format ?? "pretty";
  const deps = buildDefaultDeps({ apiUrl: options.apiUrl });

  // Resolved once, up front, so a bad headless invocation fails before any
  // side effect runs — the lanes receive inputs, never raw flags.
  let inputs: SetupInputs;
  try {
    inputs = resolveSetupInputs({ options, context: deps.context });
  } catch (error) {
    exitWithError(error, format);
  }

  try {
    const report = await lane(deps, inputs);
    // An interactive run already narrated every step through the prompter, so a
    // pretty summary would only repeat it.
    if (inputs.headless || format !== "pretty") {
      writeOutput({ message: render(report, format) });
    }
    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    exitWithError(error, format);
  }
}

async function setupHandler(options: SetupCommandOptions): Promise<void> {
  await runLane(options, runSetup, (report, format) =>
    formatSetupOutput({ report, format })
  );
}

async function setupInstrumentHandler(
  options: SetupCommandOptions
): Promise<void> {
  await runLane(options, runInstrument, (report, format) =>
    formatSetupOutput({ report, format })
  );
}

async function setupSkillsHandler(options: SetupCommandOptions): Promise<void> {
  await runLane(options, runSkills, (tooling, format) =>
    formatToolingOutput({ tooling, format })
  );
}

/** The headless + output flags every setup lane accepts. */
function addLaneOptions(command: Command, noInputHelp: string): Command {
  return command
    .option("--no-input", noInputHelp)
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    );
}

/** Flags shared by `px setup` and `px setup instrument`. */
function addConnectionOptions(command: Command): Command {
  command
    .option(
      "--endpoint <url>",
      "Phoenix endpoint (skips the endpoint question)"
    )
    .option("--project <name>", "Phoenix project name or ID");
  return addLaneOptions(
    command,
    "Headless mode: no prompts. Registers only, unless --instrument is passed"
  );
}

/** Flags that steer the instrumentation hand-off. */
function addInstrumentationOptions(command: Command): Command {
  return command
    .option(
      "--agent <agent>",
      `Coding agent to hand off to (${CODING_AGENT_IDS.join("|")}) — skips the lane prompt`
    )
    .option(
      "--language <language>",
      "Language to instrument (repeatable); skips the agent's own detection",
      collectString,
      [] as string[]
    )
    .option(
      "--background",
      "Run the agent without its TUI (implied by --no-input)"
    )
    .option(
      "--yolo",
      "Let the agent apply changes without asking permission (required in practice for --background)"
    )
    .option("--no-docs", "Skip the docs prefetch")
    .option(
      "--docs-mcp",
      "Connect the Phoenix docs MCP server to the hand-off agent (skips the docs prefetch)"
    )
    .option("--no-docs-mcp", "Skip the docs MCP offer")
    .option(
      "--workflow <name>",
      "Docs workflow to prefetch (repeatable); same values as px docs fetch",
      collectString,
      [] as string[]
    )
    .option("--refresh-docs", "Clear the docs directory before downloading")
    .option(
      "--workers <n>",
      "Concurrent docs downloads",
      parsePositiveIntOption
    );
}

function addApiUrlOption(command: Command): Command {
  return command.addOption(
    command
      .createOption(
        "--api-url <url>",
        "Route setup's API calls to this origin (dev). " +
          "Hand-off files and traces URLs keep the --endpoint value."
      )
      .hideHelp()
  );
}

function createSetupInstrumentCommand(): Command {
  const command = new Command("instrument").description(
    "Instrument this app and verify traces arrive (re-runnable on its own)"
  );
  addConnectionOptions(command);
  addInstrumentationOptions(command);
  addApiUrlOption(command);
  return command.action(setupInstrumentHandler).addHelpText(
    "after",
    `
Examples:
  px setup instrument
  px setup instrument --agent claude --language python
  px setup instrument --no-input --agent claude --yolo --format raw
`
  );
}

function createSetupSkillsCommand(): Command {
  const command = new Command("skills").description("Install agent skills");
  addLaneOptions(command, "Headless mode: install without prompting");
  // Only the negation, deliberately: with no `--skills` to pair it with,
  // Commander defaults `skills` to true, so the bare command installs rather
  // than asking a question its own name has already answered. Adding the
  // positive flag here would flip that default to "ask".
  return command
    .option("--no-skills", "Skip the skills install")
    .action(setupSkillsHandler)
    .addHelpText(
      "after",
      `
Examples:
  px setup skills
  px setup skills --no-input --format raw
`
    );
}

export function createSetupCommand(): Command {
  const command = new Command("setup");
  // The program enables positional options; `setup` must too, or it greedily
  // consumes a subcommand's flags that share a name with its own (`--agent`,
  // `--format`, `--no-input`), leaving `px setup mcp --agent codex` and
  // `px setup instrument --agent claude` unable to see their agent.
  command.enablePositionalOptions();
  command.description(
    "Interactive setup: connect this app to Phoenix and get traces flowing.\n" +
      "(A top-level command, unlike the CLI's usual noun-verb layout — onboarding is a flow, not a resource.)"
  );
  addConnectionOptions(command);
  addInstrumentationOptions(command);
  addApiUrlOption(command);
  command
    .option(
      "--instrument",
      "Run the instrumentation hand-off (default interactively; off with --no-input)"
    )
    .option("--no-instrument", "Register only: skip instrumentation")
    .option("--skills", "Install the coding-agent skills without asking")
    .option("--no-skills", "Skip the skills install")
    .action(setupHandler)
    .addHelpText(
      "after",
      `
Examples:
  px setup
  px setup --endpoint https://phoenix.example.com
  px setup --no-input --endpoint http://localhost:6006 --project my-app
  px setup --no-input --instrument --agent claude --yolo --format raw
  px setup --no-input --instrument --agent claude --yolo --docs-mcp --format raw

Subcommands:
  px setup instrument   Instrument and verify, without redoing the questions
  px setup skills       Install the coding-agent skills alone
  px setup mcp          Register the Phoenix MCP server with a coding agent
`
    );

  command.addCommand(createSetupInstrumentCommand());
  command.addCommand(createSetupSkillsCommand());
  command.addCommand(createSetupMcpCommand());
  return command;
}
