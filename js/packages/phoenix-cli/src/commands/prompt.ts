import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { formatPromptOutput, type OutputFormat } from "./formatPrompt";
import { formatPromptsOutput } from "./formatPrompts";

type Prompt = componentsV1["schemas"]["Prompt"];
type PromptVersion = componentsV1["schemas"]["PromptVersion"];

interface PromptGetOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  tag?: string;
  version?: string;
}

interface PromptListOptions {
  endpoint?: string;
  apiKey?: string;
  format?: "pretty" | "json" | "raw";
  progress?: boolean;
  limit?: number;
}

/**
 * Fetch all prompts from Phoenix
 */
async function fetchPrompts(
  client: PhoenixClient,
  options: { limit?: number } = {}
): Promise<Prompt[]> {
  const allPrompts: Prompt[] = [];
  let cursor: string | undefined;
  const pageLimit = options.limit || 100;

  do {
    const response = await client.GET("/v1/prompts", {
      params: {
        query: {
          cursor,
          limit: pageLimit,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(`Failed to fetch prompts: ${response.error}`);
    }

    allPrompts.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;

    if (options.limit && allPrompts.length >= options.limit) {
      break;
    }
  } while (cursor);

  return allPrompts;
}

/**
 * Fetch a prompt version from Phoenix
 */
async function fetchPromptVersion(
  client: PhoenixClient,
  promptIdentifier: string,
  options: { tag?: string; versionId?: string } = {}
): Promise<PromptVersion> {
  // If version ID is provided, fetch that specific version
  if (options.versionId) {
    const response = await client.GET(
      `/v1/prompt_versions/{prompt_version_id}`,
      {
        params: { path: { prompt_version_id: options.versionId } },
      }
    );

    if (response.error || !response.data) {
      throw new Error(
        `Failed to fetch prompt version: ${response.error || "Unknown error"}`
      );
    }

    return response.data.data;
  }

  // If tag is provided, fetch by tag
  if (options.tag) {
    const response = await client.GET(
      `/v1/prompts/{prompt_identifier}/tags/{tag_name}`,
      {
        params: {
          path: { prompt_identifier: promptIdentifier, tag_name: options.tag },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(
        `Failed to fetch prompt with tag "${options.tag}": ${response.error || "Unknown error"}`
      );
    }

    return response.data.data;
  }

  // Default: fetch latest version
  const response = await client.GET(`/v1/prompts/{prompt_identifier}/latest`, {
    params: {
      path: { prompt_identifier: promptIdentifier },
    },
  });

  if (response.error || !response.data) {
    throw new Error(
      `Failed to fetch prompt "${promptIdentifier}": ${response.error || "Unknown error"}`
    );
  }

  return response.data.data;
}

/**
 * Prompt command handler
 */
async function promptHandler(
  promptIdentifier: string,
  options: PromptGetOptions
): Promise<void> {
  try {
    // Resolve configuration
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    // Validate that we have endpoint
    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Create client
    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Fetching prompt "${promptIdentifier}"...`,
      noProgress: !options.progress,
    });

    // Fetch prompt version
    const promptVersion = await fetchPromptVersion(client, promptIdentifier, {
      tag: options.tag,
      versionId: options.version,
    });

    writeProgress({
      message: `Found prompt version ${promptVersion.id}`,
      noProgress: !options.progress,
    });

    // Output prompt
    const output = formatPromptOutput({
      promptVersion,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching prompt: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Handler for `prompt list`
 */
async function promptListHandler(options: PromptListOptions): Promise<void> {
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
      message: "Fetching prompts...",
      noProgress: !options.progress,
    });

    const prompts = await fetchPrompts(client, {
      limit: options.limit,
    });

    writeProgress({
      message: `Found ${prompts.length} prompt(s)`,
      noProgress: !options.progress,
    });

    const output = formatPromptsOutput({
      prompts,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching prompts: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createPromptGetCommand(): Command {
  return new Command("get")
    .description("Show a Phoenix prompt")
    .argument("<prompt-identifier>", "Prompt name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, raw, or text",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--tag <tag>", "Get prompt version by tag name")
    .option("--version <version_id>", "Get specific prompt version by ID")
    .action(promptHandler);
}

export function createPromptListCommand(): Command {
  return new Command("list")
    .description("List all available Phoenix prompts")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .option("--limit <number>", "Maximum number of prompts to fetch", parseInt)
    .action(promptListHandler);
}

/**
 * Create the `prompt` command with subcommands
 */
export function createPromptCommand(): Command {
  const command = new Command("prompt");
  command.description("Manage Phoenix prompts");
  command.addCommand(createPromptListCommand());
  command.addCommand(createPromptGetCommand());
  return command;
}
