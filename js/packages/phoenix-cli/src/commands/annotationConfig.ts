import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import {
  formatAnnotationConfigsOutput,
  type OutputFormat,
} from "./formatAnnotationConfigs";

type AnnotationConfig =
  | componentsV1["schemas"]["CategoricalAnnotationConfig"]
  | componentsV1["schemas"]["ContinuousAnnotationConfig"]
  | componentsV1["schemas"]["FreeformAnnotationConfig"];

interface AnnotationConfigListOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

/**
 * Fetch all annotation configs from Phoenix
 */
async function fetchAnnotationConfigs(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<AnnotationConfig[]> {
  const allConfigs: AnnotationConfig[] = [];
  let cursor: string | undefined;
  const pageLimit = options.limit || 100;

  do {
    const response = await client.GET("/v1/annotation_configs", {
      params: {
        query: {
          cursor,
          limit: pageLimit,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch annotation configs: ${response.error}`);
    }

    allConfigs.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    // If we've fetched enough for the requested limit, stop
    if (options.limit && allConfigs.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allConfigs;
}

/**
 * Handler for `annotation-config list`
 */
async function annotationConfigListHandler(
  options: AnnotationConfigListOptions
): Promise<void> {
  try {
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const client = createPhoenixClient({ config });

    writeProgress({
      message: "Fetching annotation configs...",
      noProgress: !options.progress,
    });

    const configs = await fetchAnnotationConfigs(client, {
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${configs.length} annotation config(s)`,
      noProgress: !options.progress,
    });

    const output = formatAnnotationConfigsOutput({
      configs,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching annotation configs: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the `annotation-config` command with subcommands
 */
export function createAnnotationConfigCommand(): Command {
  const command = new Command("annotation-config");
  command.description("Manage Phoenix annotation configurations");

  const listCommand = new Command("list");
  listCommand
    .description("List all annotation configurations")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option(
      "--limit <number>",
      "Maximum number of annotation configs to fetch",
      parseInt
    )
    .action(annotationConfigListHandler);

  command.addCommand(listCommand);

  return command;
}
