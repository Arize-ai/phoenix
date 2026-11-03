import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import { ExitCode, InvalidArgumentError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import {
  collectString,
  parseFormatOption,
  parsePositiveIntOption,
} from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { exitWithError, requireValidLimitOrExit } from "./evaluatorErrors";
import { formatDecisionOutput, type OutputFormat } from "./formatDecision";
import { formatDecisionsOutput } from "./formatDecisions";
import type { CommonOptions, DeleteOptions } from "./options";

type Decision = componentsV1["schemas"]["Decision"];
type DecisionVersion = componentsV1["schemas"]["DecisionVersion"];

/**
 * Options for `px decision list`.
 */
interface DecisionListOptions extends CommonOptions<OutputFormat> {
  /**
   * `--limit <number>`: Maximum number of decisions to fetch. Fetches every
   * decision when omitted.
   *
   * @example 20
   */
  limit?: number;
  /**
   * `--name <text>`: Only decisions whose name contains this text, ignoring
   * case.
   *
   * @example "triage"
   */
  name?: string;
  /**
   * `--label <label>`: Only decisions with any of these labels, each given
   * by its name or its ID. Repeatable; defaults to none.
   *
   * @example ["support", "RGVjaXNpb25MYWJlbDox"]
   */
  label?: string[];
}

/**
 * Options for `px decision get <decision-identifier>`. `--tag` and `--version`
 * select a version; without either, the latest version is shown.
 */
interface DecisionGetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--tag <tag>`: Show the version this tag points to.
   *
   * @example "production"
   */
  tag?: string;
  /**
   * `--version <version-id>`: Show this version. It must belong to
   * `<decision-identifier>`.
   *
   * @example "RGVjaXNpb25WZXJzaW9uOjQ="
   */
  version?: string;
}

/**
 * Options for `px decision delete <decision-identifier>`.
 */
interface DecisionDeleteOptions extends DeleteOptions {
  /**
   * `--format <format>`: How a refusal is rendered on stderr. `pretty` (the
   * default) is human-readable, `raw` and `json` carry the structured error
   * (`problem_code`, `problem_reason`, `problem`) for scripts and agents.
   *
   * @example "raw" // px decision delete ticket-triage --yes --format raw
   */
  format?: OutputFormat;
}

function createClientOrExit(options: {
  endpoint?: string;
  apiKey?: string;
}): PhoenixClient {
  const config = resolveConfig({
    cliOptions: {
      endpoint: options.endpoint,
      apiKey: options.apiKey,
    },
  });
  const validation = validateConfig({ config, projectRequired: false });
  if (!validation.valid) {
    writeError({
      message: getConfigErrorMessage({ errors: validation.errors }),
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  return createPhoenixClient({ config });
}

/**
 * Fetch decisions, newest first, following the cursor until `limit` decisions
 * are collected or none remain.
 */
async function fetchDecisions({
  client,
  limit,
  name,
  labels,
}: {
  client: PhoenixClient;
  limit?: number;
  name?: string;
  labels?: string[];
}): Promise<Decision[]> {
  const decisions: Decision[] = [];
  let cursor: string | undefined;
  do {
    const response = await client.GET("/v1/decisions", {
      params: {
        query: {
          cursor,
          limit: limit ? Math.min(limit - decisions.length, 100) : 100,
          name,
          label: labels,
        },
      },
    });
    if (!response.data) {
      throw new Error("Failed to fetch decisions: empty response");
    }
    decisions.push(...response.data.data);
    cursor = response.data.next_cursor ?? undefined;
  } while (cursor && (!limit || decisions.length < limit));
  return limit ? decisions.slice(0, limit) : decisions;
}

/**
 * Fetch the version `px decision get` shows: by `--version`, by `--tag`, or the
 * latest.
 */
async function fetchDecisionVersion({
  client,
  decisionIdentifier,
  tag,
  versionId,
}: {
  client: PhoenixClient;
  decisionIdentifier: string;
  tag?: string;
  versionId?: string;
}): Promise<DecisionVersion> {
  if (versionId) {
    const response = await client.GET(
      "/v1/decision_versions/{decision_version_id}",
      { params: { path: { decision_version_id: versionId } } }
    );
    if (!response.data) {
      throw new Error("Failed to fetch decision version: empty response");
    }
    const version = response.data.data;
    // A version ID names its own decision; never show another decision's
    // version under the name the caller asked for.
    if (
      decisionIdentifier !== version.decision_id &&
      decisionIdentifier !== version.decision_name
    ) {
      throw new InvalidArgumentError(
        `Version ${versionId} belongs to decision '${version.decision_name}', not '${decisionIdentifier}'`,
        {
          hint: `px decision get ${version.decision_name} --version ${versionId}`,
        }
      );
    }
    return version;
  }
  if (tag) {
    const response = await client.GET(
      "/v1/decisions/{decision_identifier}/tags/{tag_name}",
      {
        params: {
          path: { decision_identifier: decisionIdentifier, tag_name: tag },
        },
      }
    );
    if (!response.data) {
      throw new Error("Failed to fetch decision version: empty response");
    }
    return response.data.data;
  }
  const response = await client.GET(
    "/v1/decisions/{decision_identifier}/latest",
    { params: { path: { decision_identifier: decisionIdentifier } } }
  );
  if (!response.data) {
    throw new Error("Failed to fetch decision version: empty response");
  }
  return response.data.data;
}

/**
 * Handler for `decision list`
 */
async function decisionListHandler(
  options: DecisionListOptions
): Promise<void> {
  requireValidLimitOrExit({ limit: options.limit, format: options.format });
  try {
    const client = createClientOrExit(options);
    writeProgress({
      message: "Fetching decisions...",
      noProgress: !options.progress,
    });
    const decisions = await fetchDecisions({
      client,
      limit: options.limit,
      name: options.name,
      labels: options.label?.length ? options.label : undefined,
    });
    writeProgress({
      message: `Found ${decisions.length} decision(s)`,
      noProgress: !options.progress,
    });
    writeOutput({
      message: formatDecisionsOutput({ decisions, format: options.format }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching decisions",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `decision get`
 */
async function decisionGetHandler(
  decisionIdentifier: string,
  options: DecisionGetOptions
): Promise<void> {
  if (options.tag && options.version) {
    writeStructuredError({
      format: options.format,
      message: "Specify either --tag or --version, not both",
      code: "INVALID_ARGUMENT",
      hint: `px decision get ${decisionIdentifier} --tag ${options.tag}`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  try {
    const client = createClientOrExit(options);
    writeProgress({
      message: `Fetching decision ${decisionIdentifier}...`,
      noProgress: !options.progress,
    });
    const decisionVersion = await fetchDecisionVersion({
      client,
      decisionIdentifier,
      tag: options.tag,
      versionId: options.version,
    });
    writeProgress({
      message: `Found version ${decisionVersion.version_number} (${decisionVersion.id})`,
      noProgress: !options.progress,
    });
    writeOutput({
      message: formatDecisionOutput({
        decisionVersion,
        format: options.format,
      }),
    });
  } catch (error) {
    await exitWithError({
      verb: "fetching decision",
      error,
      format: options.format,
    });
  }
}

/**
 * Handler for `decision delete`
 */
async function decisionDeleteHandler(
  decisionIdentifier: string,
  options: DecisionDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();
    const client = createClientOrExit(options);
    await confirmOrExit({
      message: `Delete decision ${decisionIdentifier}? This also deletes all its versions, tags, and labels. Experiments that ran it keep their results. This cannot be undone.`,
      yes: options.yes,
    });
    await client.DELETE("/v1/decisions/{decision_identifier}", {
      params: { path: { decision_identifier: decisionIdentifier } },
    });
    writeProgress({
      message: `Deleted decision ${decisionIdentifier}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    await exitWithError({
      verb: "deleting decision",
      error,
      format: options.format,
    });
  }
}

function addCommonReadOptions(command: Command): Command {
  return command
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      parseFormatOption,
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators");
}

export function createDecisionListCommand(): Command {
  return addCommonReadOptions(
    new Command("list")
      .description("List saved decisions, newest first")
      .option(
        "--name <text>",
        "Only decisions whose name contains this text, ignoring case"
      )
      .option(
        "--label <label>",
        "Only decisions with this label, by name or ID (repeatable)",
        collectString,
        []
      )
      .option(
        "--limit <number>",
        "Maximum number of decisions to fetch",
        parsePositiveIntOption
      )
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # List every decision\n" +
        "  px decision list\n\n" +
        "  # List the decisions labeled support or billing\n" +
        "  px decision list --label support --label billing\n\n" +
        "  # Find decisions by name and print their IDs (agent-friendly)\n" +
        "  px decision list --name triage --format raw --no-progress | jq -r '.[].id'\n"
    )
    .action(decisionListHandler);
}

export function createDecisionGetCommand(): Command {
  return addCommonReadOptions(
    new Command("get")
      .description(
        "Show a version of a saved decision: the latest, the one a tag points to, or a specific one"
      )
      .argument("<decision-identifier>", "Decision name or ID")
      .option("--tag <tag>", "Show the version this tag points to")
      .option("--version <version-id>", "Show this version of the decision")
  )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Show the latest version\n" +
        "  px decision get ticket-triage\n\n" +
        "  # Show the production version\n" +
        "  px decision get ticket-triage --tag production\n\n" +
        "  # Print the variables a call must supply (agent-friendly)\n" +
        "  px decision get ticket-triage --tag production --format raw --no-progress | jq -r '.variables[]'\n"
    )
    .action(decisionGetHandler);
}

export function createDecisionDeleteCommand(): Command {
  return new Command("delete")
    .description(
      "Delete a saved decision with its versions, tags, and labels. A decision an evaluator runs is refused; delete the evaluator first."
    )
    .argument("<decision-identifier>", "Decision name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format for a refusal: pretty, json, or raw",
      parseFormatOption,
      "pretty"
    )
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Delete a decision; deletes are gated by PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true\n" +
        "  px decision delete ticket-triage --yes\n\n" +
        "  # Find the evaluators that block a delete (agent-friendly)\n" +
        "  px decision delete ticket-triage --yes --format raw --no-progress 2>&1 | jq -r '.problem.detail'\n"
    )
    .action(decisionDeleteHandler);
}

/**
 * Create the `decision` command with subcommands
 */
export function createDecisionCommand(): Command {
  const command = new Command("decision");
  command.description("Manage saved Phoenix decisions");
  command.addCommand(createDecisionListCommand());
  command.addCommand(createDecisionGetCommand());
  command.addCommand(createDecisionDeleteCommand());
  return command;
}
