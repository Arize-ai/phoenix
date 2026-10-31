import type { PhoenixClient } from "@arizeai/phoenix-client";
import { Command, Option } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import {
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeOutput, writeProgress } from "../io";
import { writeStructuredError } from "../structuredError";
import {
  formatPromptVersionsOutput,
  type PromptVersion,
} from "./formatPromptVersions";
import type { CommonOptions } from "./options";

interface PromptVersionsListOptions extends CommonOptions {
  /**
   * `--limit <number>`: Maximum number of versions to fetch. By default,
   * fetches all versions in pages of 100.
   *
   * @example 10
   */
  limit?: number;
}

async function fetchPromptVersions({
  client,
  promptIdentifier,
  limit,
}: {
  client: PhoenixClient;
  promptIdentifier: string;
  limit?: number;
}): Promise<PromptVersion[]> {
  const promptVersions: PromptVersion[] = [];
  let cursor: string | undefined;

  do {
    const pageLimit = limit === undefined ? 100 : limit - promptVersions.length;
    const response = await client.GET(
      "/v1/prompts/{prompt_identifier}/versions",
      {
        params: {
          path: { prompt_identifier: promptIdentifier },
          query: { cursor, limit: pageLimit },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(
        `Failed to fetch prompt versions: ${JSON.stringify(response.error)}`
      );
    }

    promptVersions.push(...response.data.data.slice(0, pageLimit));
    cursor = response.data.next_cursor || undefined;
  } while (cursor && (limit === undefined || promptVersions.length < limit));

  return promptVersions;
}

async function promptVersionsListHandler({
  promptIdentifier,
  options,
}: {
  promptIdentifier: string;
  options: PromptVersionsListOptions;
}): Promise<void> {
  let hint: string | undefined;
  try {
    if (
      options.limit !== undefined &&
      (!Number.isSafeInteger(options.limit) || options.limit <= 0)
    ) {
      hint = "px prompt-versions list <prompt-identifier> --limit <number>";
      throw new InvalidArgumentError("--limit must be a positive integer");
    }
    const config = resolveConfig({ cliOptions: options });
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      throw new InvalidArgumentError(
        getConfigErrorMessage({ errors: validation.errors })
      );
    }
    const client = createPhoenixClient({ config });
    writeProgress({
      message: `Fetching versions of prompt "${promptIdentifier}"...`,
      noProgress: !options.progress,
    });

    const promptVersions = await fetchPromptVersions({
      client,
      promptIdentifier,
      limit: options.limit,
    });

    // Prompts are created with a version, so an empty list means a missing prompt.
    if (promptVersions.length === 0) {
      hint = "px prompt list";
      throw new Error(`Prompt "${promptIdentifier}" not found`);
    }

    writeProgress({
      message: `Found ${promptVersions.length} prompt version(s)`,
      noProgress: !options.progress,
    });
    writeOutput({
      message: formatPromptVersionsOutput({
        promptVersions,
        format: options.format,
      }),
    });
  } catch (error) {
    const exitCode = getExitCodeForError(error);
    writeStructuredError({
      format: options.format,
      message: `Error fetching prompt versions: ${error instanceof Error ? error.message : String(error)}`,
      code:
        Object.entries(ExitCode).find(([, value]) => value === exitCode)?.[0] ??
        "FAILURE",
      hint,
    });
    process.exit(exitCode);
  }
}

export function createPromptVersionsCommand(): Command {
  const command = new Command("prompt-versions").description(
    "Manage Phoenix prompt versions"
  );
  command
    .command("list")
    .description("List versions of a Phoenix prompt")
    .argument("<prompt-identifier>", "Prompt name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .addOption(
      new Option("--format <format>", "Output format")
        .choices(["pretty", "json", "raw"])
        .default("pretty")
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--limit <number>", "Maximum number of versions to fetch", Number)
    .addHelpText(
      "after",
      `
Examples:
  px prompt-versions list my-prompt
  px prompt-versions list my-prompt --limit 10 --format json
  px prompt-versions list my-prompt --format raw --no-progress`
    )
    .action((promptIdentifier: string, options: PromptVersionsListOptions) =>
      promptVersionsListHandler({ promptIdentifier, options })
    );
  return command;
}
