import {
  type componentsV1,
  HttpError,
  type PhoenixClient,
} from "@arizeai/phoenix-client";
import { upsertPromptVersionTag } from "@arizeai/phoenix-client/prompts";
import { Command, Option } from "commander";

import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import {
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { writeStructuredError } from "../structuredError";
import { formatPromptOutput, type OutputFormat } from "./formatPrompt";
import { formatPromptsOutput } from "./formatPrompts";
import {
  type AppliedPromptVersionTag,
  formatPromptVersionTagOutput,
} from "./formatPromptVersionTag";
import type { CommonOptions, DeleteOptions } from "./options";

type Prompt = componentsV1["schemas"]["Prompt"];
type PromptVersion = componentsV1["schemas"]["PromptVersion"];

/**
 * Options for `px prompt get <prompt-identifier>`. `--tag` and `--version`
 * are alternative ways to select a specific version; without either, fetches
 * the latest version.
 */
interface PromptGetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--tag <tag>`: Get the prompt version currently labeled with this tag.
   *
   * @example "production"
   */
  tag?: string;
  /**
   * `--version <version_id>`: Get a specific prompt version by ID.
   *
   * @example "UHJvbXB0VmVyc2lvbjox"
   */
  version?: string;
}

/**
 * Options for `px prompt list`.
 */
interface PromptListOptions extends CommonOptions {
  /**
   * `--limit <number>`: Maximum number of prompts to fetch. Defaults to 100.
   *
   * @example 50
   */
  limit?: number;
}

/**
 * Options for `px prompt tag <prompt-version-id>`.
 */
interface PromptTagOptions extends CommonOptions {
  /**
   * `--tag <name>`: Required. Prompt-scoped tag name. Must match Phoenix's
   * identifier rule: lowercase letters, digits, `-` and `_`, starting and
   * ending with a letter or digit.
   *
   * @example "production"
   */
  tag?: string;
  /**
   * `--description <text>`: Description stored on the tag. Omitting it clears
   * any existing description on the tag.
   *
   * @example "Currently deployed version"
   */
  description?: string;
}

const PROMPT_TAG_USAGE =
  "px prompt tag <prompt-version-id> --tag <name> [--description <text>]";

/**
 * Mirrors the server's `Identifier` constraint on tag names, so invalid names
 * fail locally with usage instead of as an opaque 422.
 */
const TAG_NAME_PATTERN = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

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
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
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

    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      writeError({
        message: getConfigErrorMessage({ errors: validation.errors }),
      });
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

/**
 * Handler for `prompt delete`
 */
async function promptDeleteHandler(
  promptIdentifier: string,
  options: DeleteOptions
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
      message: `Delete prompt ${promptIdentifier}? This will also delete all versions, tags, and labels. This cannot be undone.`,
      yes: options.yes,
    });

    const response = await client.DELETE("/v1/prompts/{prompt_identifier}", {
      params: {
        path: {
          prompt_identifier: promptIdentifier,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete prompt: ${response.error}`);
    }

    writeProgress({
      message: `Deleted prompt ${promptIdentifier}`,
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting prompt: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Map a failed tag request to an exit code and a resolution hint. The client
 * middleware turns non-2xx responses into `HttpError`; anything else (network
 * `TypeError`, validation errors) falls back to `getExitCodeForError`.
 */
function classifyPromptTagError(error: unknown): {
  exitCode: ExitCode;
  hint?: string;
} {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) {
      return { exitCode: ExitCode.AUTH_REQUIRED, hint: "px auth status" };
    }
    if (error.status === 404) {
      return {
        exitCode: ExitCode.FAILURE,
        hint: "px prompt-versions list <prompt-identifier>",
      };
    }
    if (error.status === 422) {
      return { exitCode: ExitCode.INVALID_ARGUMENT, hint: PROMPT_TAG_USAGE };
    }
  }
  return { exitCode: getExitCodeForError(error) };
}

/**
 * Handler for `prompt tag`: create a tag on a prompt version, or move an
 * existing tag of the same name to it.
 */
async function promptTagHandler({
  promptVersionId,
  options,
}: {
  promptVersionId: string;
  options: PromptTagOptions;
}): Promise<void> {
  try {
    if (!promptVersionId.trim()) {
      throw new InvalidArgumentError(
        `Invalid value for <prompt-version-id>: <empty>.\n  ${PROMPT_TAG_USAGE}`
      );
    }
    if (options.tag === undefined) {
      throw new InvalidArgumentError(
        `Missing required flag --tag.\n  ${PROMPT_TAG_USAGE}`
      );
    }
    if (!TAG_NAME_PATTERN.test(options.tag)) {
      throw new InvalidArgumentError(
        `Invalid value for --tag: "${options.tag}". Use lowercase letters, digits, "-" or "_", starting and ending with a letter or digit.\n  ${PROMPT_TAG_USAGE}`
      );
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
      message: `Tagging prompt version ${promptVersionId} as "${options.tag}"...`,
      noProgress: !options.progress,
    });

    // The server upserts by (prompt, name) and overwrites the description, so
    // omitting --description clears any description the tag had before.
    await upsertPromptVersionTag({
      client,
      prompt: { versionId: promptVersionId },
      name: options.tag,
      description: options.description,
    });

    const tag: AppliedPromptVersionTag = {
      prompt_version_id: promptVersionId,
      name: options.tag,
      description: options.description ?? null,
    };
    writeOutput({
      message: formatPromptVersionTagOutput({ tag, format: options.format }),
    });
  } catch (error) {
    const { exitCode, hint } = classifyPromptTagError(error);
    writeStructuredError({
      format: options.format,
      message: `Error tagging prompt version: ${error instanceof Error ? error.message : String(error)}`,
      code:
        Object.entries(ExitCode).find(([, value]) => value === exitCode)?.[0] ??
        "FAILURE",
      hint,
    });
    process.exit(exitCode);
  }
}

export function createPromptTagCommand(): Command {
  return new Command("tag")
    .description(
      "Tag a prompt version, moving the tag if another version of the prompt has it"
    )
    .argument(
      "<prompt-version-id>",
      "Prompt version ID (discover IDs with px prompt-versions list)"
    )
    .option(
      "--tag <name>",
      "Tag name (required; lowercase letters, digits, - and _)"
    )
    .option(
      "--description <text>",
      "Tag description (omitting it clears an existing description)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .addOption(
      new Option("--format <format>", "Output format")
        .choices(["pretty", "json", "raw"])
        .default("pretty")
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      `
Examples:
  px prompt tag UHJvbXB0VmVyc2lvbjox --tag production
  px prompt tag UHJvbXB0VmVyc2lvbjox --tag production --description "Current release"
  px prompt tag UHJvbXB0VmVyc2lvbjox --tag staging --format raw --no-progress

If another version of the same prompt already has the tag, the tag moves to
this version. The tag's description is replaced on every call: omitting
--description clears an existing description.`
    )
    .action((promptVersionId: string, options: PromptTagOptions) =>
      promptTagHandler({ promptVersionId, options })
    );
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
    .option(
      "--version <version_id>",
      "Get specific prompt version by ID (discover IDs with px prompt-versions list)"
    )
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

export function createPromptDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a prompt")
    .argument("<prompt-identifier>", "Prompt name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .action(promptDeleteHandler);
}

/**
 * Create the `prompt` command with subcommands
 */
export function createPromptCommand(): Command {
  const command = new Command("prompt");
  command.description("Manage Phoenix prompts");
  command.addCommand(createPromptListCommand());
  command.addCommand(createPromptGetCommand());
  command.addCommand(createPromptTagCommand());
  command.addCommand(createPromptDeleteCommand());
  return command;
}
