import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
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

interface AnnotationConfigDeleteOptions {
  endpoint?: string;
  apiKey?: string;
  yes?: boolean;
  progress?: boolean;
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

    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
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
 * Handler for `annotation-config delete`
 */
async function annotationConfigDeleteHandler(
  configId: string,
  options: AnnotationConfigDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

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

    const client = createPhoenixClient({ config });

    await confirmOrExit({
      message: `Delete annotation config ${configId}? This cannot be undone.`,
      yes: options.yes,
    });

    const response = await client.DELETE("/v1/annotation_configs/{config_id}", {
      params: {
        path: {
          config_id: configId,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete annotation config: ${response.error}`);
    }

    writeProgress({
      message: `Deleted annotation config ${configId}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting annotation config: ${error instanceof Error ? error.message : String(error)}`,
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
  command.addCommand(createAnnotationConfigDeleteCommand());

  return command;
}

export function createAnnotationConfigDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete an annotation configuration")
    .argument("<config-id>", "Annotation config ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(annotationConfigDeleteHandler);
}
