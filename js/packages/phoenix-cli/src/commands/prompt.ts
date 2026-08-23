import { readFileSync } from "node:fs";
import {
  HttpError,
  type componentsV1,
  type PhoenixClient,
} from "@arizeai/phoenix-client";
import { Command } from "commander";

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
import { collectString } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import { formatPromptOutput, type OutputFormat } from "./formatPrompt";
import { formatPromptsOutput } from "./formatPrompts";
import type { CommonOptions, DeleteOptions } from "./options";
import {
  assertPromptIdentifier,
  buildPromptSetRequest,
  hasPromptVersionInput,
  parsePromptSetFile,
  parsePromptSetFlags,
  PROMPT_SET_USAGE_HINT,
  type PromptSetFileContents,
} from "./promptSet";

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
 * Options for `px prompt set <prompt-identifier>`. Creates the prompt when
 * it does not exist; otherwise appends a new version. Fields omitted on an
 * update are copied from the latest version.
 */
interface PromptSetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--template <text>`: Prompt body as a single user message. Mutually
   * exclusive with `--message`.
   *
   * @example "Hello {{name}}"
   */
  template?: string;
  /**
   * `--message <role:content>`: Chat message, repeatable. Role is one of
   * `user`, `assistant`, `system`, `developer`, `model`, `ai`, `tool`.
   *
   * @example ["system:You are helpful", "user:Hello {{name}}"]
   */
  message?: string[];
  /**
   * `--file <path>`: JSON prompt body. Accepts the POST /v1/prompts payload,
   * a `PromptVersion` (`px prompt get --format raw`), or `{messages: [...]}`.
   * Use `-` to read stdin.
   *
   * @example "prompt.json"
   */
  file?: string;
  /**
   * `--model <name>`: Model name for the new version. Required when creating
   * a prompt unless `--file` already has `model_name`.
   *
   * @example "gpt-4o"
   */
  model?: string;
  /**
   * `--model-provider <provider>`: Model provider. Case-insensitive.
   * Defaults to `OPENAI` on create; copied from the latest version on update.
   *
   * @example "OPENAI"
   */
  modelProvider?: string;
  /**
   * `--template-format <format>`: `MUSTACHE`, `F_STRING`, or `NONE`.
   * Defaults to `MUSTACHE` on create.
   *
   * @example "MUSTACHE"
   */
  templateFormat?: string;
  /**
   * `--description <text>`: Prompt description. Applied when creating a
   * prompt; the API does not update it on an existing prompt.
   *
   * @example "Greets the user by name"
   */
  description?: string;
  /**
   * `--version-description <text>`: Description of this prompt version.
   *
   * @example "Rewrote the greeting"
   */
  versionDescription?: string;
  /**
   * `--invocation-parameters <json>`: Provider invocation parameters as a
   * JSON object, e.g. `{"temperature":0.2}`. Anthropic requires `max_tokens`.
   *
   * @example '{"temperature":0.2}'
   */
  invocationParameters?: string;
  /**
   * `--metadata <json>`: Prompt metadata as a JSON object. Applied when
   * creating a prompt.
   *
   * @example '{"team":"evals"}'
   */
  metadata?: string;
  /**
   * `--tag <name>`: Tag the newly written version (e.g. `production`).
   *
   * @example "production"
   */
  tag?: string;
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
 * Handler for `prompt set`
 */
async function promptSetHandler(
  promptIdentifier: string,
  options: PromptSetOptions
): Promise<void> {
  const format = structuredErrorFormat(options.format);
  if (!hasPromptVersionInput(options)) {
    writeStructuredError({
      format,
      message:
        "Provide a template (--template, --message, or --file) or a version field to change (--model, --model-provider, --template-format, --invocation-parameters, --version-description)",
      code: "INVALID_ARGUMENT",
      hint: PROMPT_SET_USAGE_HINT,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  let name: string;
  let flags: ReturnType<typeof parsePromptSetFlags>;
  let file: PromptSetFileContents | undefined;
  try {
    name = assertPromptIdentifier(promptIdentifier, "Prompt name");
    flags = parsePromptSetFlags(options);
    if (options.file !== undefined) {
      file = parsePromptSetFile(await readPromptSetFile(options.file));
    }
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      writeStructuredError({
        format,
        message: error.message,
        code: "INVALID_ARGUMENT",
        hint: PROMPT_SET_USAGE_HINT,
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
    throw error;
  }

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

    const existing = await fetchLatestPromptVersionOrUndefined(
      client,
      promptIdentifier
    );

    const body = buildPromptSetRequest({
      name,
      flags,
      file,
      existing,
    });

    writeProgress({
      message: `Saving prompt "${name}"...`,
      noProgress: !options.progress,
    });

    const response = await client.POST("/v1/prompts", {
      body,
    });

    if (response.error || !response.data) {
      throw new Error(
        `Failed to save prompt: ${response.error || "Unknown error"}`
      );
    }

    const promptVersion = response.data.data;

    if (flags.tag !== undefined) {
      const tagResponse = await client.POST(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        {
          params: {
            path: { prompt_version_id: promptVersion.id },
          },
          body: { name: flags.tag },
        }
      );
      if (tagResponse.error) {
        throw new Error(
          `Saved prompt version ${promptVersion.id} but failed to tag it '${flags.tag}': ${tagResponse.error}`
        );
      }
    }

    writeProgress({
      message:
        flags.tag !== undefined
          ? `Saved prompt version ${promptVersion.id} (tag: ${flags.tag})`
          : `Saved prompt version ${promptVersion.id}`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatPromptOutput({
        promptVersion,
        format: options.format,
      }),
    });
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      writeStructuredError({
        format,
        message: error.message,
        code: "INVALID_ARGUMENT",
        hint: PROMPT_SET_USAGE_HINT,
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
    writeError({
      message: `Error saving prompt: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

async function fetchLatestPromptVersionOrUndefined(
  client: PhoenixClient,
  promptIdentifier: string
): Promise<PromptVersion | undefined> {
  try {
    return await fetchPromptVersion(client, promptIdentifier);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function readPromptSetFile(filePath: string): Promise<string> {
  if (filePath === "-") {
    if (process.stdin.isTTY) {
      throw new InvalidArgumentError(
        "No prompt JSON on stdin. Pipe a file or pass --file <path>"
      );
    }
    return readStdin();
  }
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    throw new InvalidArgumentError(
      `Failed to read --file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
  });
}

function structuredErrorFormat(
  format: OutputFormat | undefined
): "pretty" | "json" | "raw" {
  return format === "json" || format === "raw" ? format : "pretty";
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

export function createPromptSetCommand(): Command {
  return new Command("set")
    .description("Create a prompt or append a new version")
    .argument("<prompt-identifier>", "Prompt name")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--template <text>", "Prompt body as a single user message")
    .option(
      "--message <role:content>",
      "Chat message, e.g. user:Hello (repeatable)",
      collectString,
      []
    )
    .option(
      "--file <path>",
      "JSON prompt body (POST /v1/prompts or px prompt get --format raw). Use - for stdin"
    )
    .option("--model <name>", "Model name, e.g. gpt-4o")
    .option(
      "--model-provider <provider>",
      "Model provider (default: OPENAI on create)"
    )
    .option(
      "--template-format <format>",
      "MUSTACHE, F_STRING, or NONE (default: MUSTACHE on create)"
    )
    .option(
      "--description <text>",
      "Prompt description (applied when creating the prompt)"
    )
    .option("--version-description <text>", "Description of this version")
    .option(
      "--invocation-parameters <json>",
      "Provider invocation parameters, e.g. '{\"temperature\":0.2}'"
    )
    .option("--metadata <json>", "Prompt metadata as a JSON object")
    .option("--tag <name>", "Tag the newly written version, e.g. production")
    .option(
      "--format <format>",
      "Output format: pretty, json, raw, or text",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nCreates the named prompt, or appends a new version if it already exists. " +
        "Omitted fields are copied from the latest version.\n" +
        "\nExamples:\n" +
        "  # Create a prompt from a template string\n" +
        '  px prompt set greeting --template "Hello {{name}}" --model gpt-4o\n\n' +
        "  # Chat prompt with a system and user message\n" +
        '  px prompt set greeting --message "system:You are a helpful assistant" --message "user:Hello {{name}}" --model gpt-4o\n\n' +
        "  # Update only the template; model and other fields stay as they are\n" +
        '  px prompt set greeting --template "Hi {{name}}"\n\n' +
        "  # Create from a JSON file and tag the version (agent-friendly)\n" +
        "  px prompt set greeting --file prompt.json --tag production --format raw --no-progress\n\n" +
        "  # Round-trip the latest version through a file\n" +
        "  px prompt get greeting --format raw --no-progress | px prompt set greeting --file -\n"
    )
    .action(promptSetHandler);
}

/**
 * Create the `prompt` command with subcommands
 */
export function createPromptCommand(): Command {
  const command = new Command("prompt");
  command.description("Manage Phoenix prompts");
  command.addCommand(createPromptListCommand());
  command.addCommand(createPromptGetCommand());
  command.addCommand(createPromptSetCommand());
  command.addCommand(createPromptDeleteCommand());
  return command;
}
