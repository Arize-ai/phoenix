import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";
import {
  formatModelProvidersOutput,
  type OutputFormat,
} from "./formatModelProviders";
import type { CommonOptions } from "./options";

/**
 * Handler for `model-provider list`.
 *
 * Lists the built-in model provider families the connected deployment allows,
 * which the server narrows by `PHOENIX_ALLOWED_PROVIDERS` when it is set.
 */
async function modelProviderListHandler(
  options: CommonOptions<OutputFormat>
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
    const response = await client.GET("/v1/model_providers");

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch model providers: ${response.error}`);
    }

    writeOutput({
      message: formatModelProvidersOutput({
        modelProviders: response.data.data,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error fetching model providers: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createModelProviderListCommand(): Command {
  return new Command("list")
    .description(
      "List the built-in model providers allowed by the Phoenix deployment"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  px model-provider list\n" +
        "  px model-provider list --format raw --no-progress | jq -r '.[].provider'\n"
    )
    .action(modelProviderListHandler);
}

/**
 * Create the `model-provider` command with subcommands
 */
export function createModelProviderCommand(): Command {
  const command = new Command("model-provider");
  command.description("Inspect model providers available to Phoenix");
  command.addCommand(createModelProviderListCommand());
  return command;
}
