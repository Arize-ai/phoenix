import * as fs from "fs";
import {
  type componentsV1,
  HttpError,
  type PhoenixClient,
} from "@arizeai/phoenix-client";
import {
  promptVersion,
  type PromptVersionInput,
} from "@arizeai/phoenix-client/prompts";
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
import { parsePositiveIntOption } from "../optionParsers";
import { formatPromptOutput, type OutputFormat } from "./formatPrompt";
import { formatPromptsOutput } from "./formatPrompts";
import type { CommonOptions, DeleteOptions } from "./options";

type Prompt = componentsV1["schemas"]["Prompt"];
type PromptVersion = componentsV1["schemas"]["PromptVersion"];
type PromptTemplateFormat = componentsV1["schemas"]["PromptTemplateFormat"];

/**
 * Providers `px prompt create` can target: the ones the client's
 * `promptVersion()` helper knows how to build invocation parameters for.
 */
type CreatableModelProvider = PromptVersionInput["modelProvider"];

/**
 * The invocation parameter `--max-tokens` sets for each provider. OpenAI and
 * Azure use `max_completion_tokens` because reasoning models reject the older
 * `max_tokens`.
 */
const MAX_TOKENS_PARAMETER: Record<
  CreatableModelProvider,
  "max_tokens" | "max_completion_tokens" | "max_output_tokens"
> = {
  OPENAI: "max_completion_tokens",
  AZURE_OPENAI: "max_completion_tokens",
  ANTHROPIC: "max_tokens",
  GOOGLE: "max_output_tokens",
  DEEPSEEK: "max_tokens",
  XAI: "max_tokens",
  OLLAMA: "max_tokens",
  AWS: "max_tokens",
};

const CREATABLE_MODEL_PROVIDERS = Object.keys(
  MAX_TOKENS_PARAMETER
) as CreatableModelProvider[];

const TEMPLATE_FORMATS: readonly PromptTemplateFormat[] = [
  "MUSTACHE",
  "F_STRING",
  "NONE",
];

/**
 * Model used when `--model-name` is omitted with the default `OPENAI`
 * provider. Matches the playground's `DEFAULT_MODEL_NAME` in
 * `js/app/src/constants/generativeConstants.ts`.
 */
const DEFAULT_OPENAI_MODEL_NAME = "gpt-5.6-luna";

/**
 * Pattern the server requires for prompt names. Mirrors `Identifier` in
 * `src/phoenix/db/types/identifier.py`.
 */
const PROMPT_NAME_PATTERN = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

const PROMPT_CREATE_USAGE =
  "  px prompt create --name <name> --template <text>\n" +
  "  px prompt create --name <name> --template-file <path|->";

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
 * Options for `px prompt create`. The template comes from exactly one of
 * `--template` or `--template-file`.
 */
interface PromptCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: Name of the prompt. If a prompt with this name already
   * exists, the template is saved as its new latest version unless
   * `--if-not-exists` is passed.
   *
   * @example "greeting"
   */
  name?: string;
  /**
   * `--if-not-exists`: When a prompt with this name already exists, print its
   * latest version instead of adding a new one.
   *
   * @example true // px prompt create --name greeting --template Hi --if-not-exists
   */
  ifNotExists?: boolean;
  /**
   * `--description <description>`: Description of the prompt. Only applied
   * when the prompt is new; an existing prompt keeps its description.
   *
   * @example "Says hello to the user"
   */
  description?: string;
  /**
   * `--template <text>`: Template text, sent as a single user message.
   *
   * @example "Hello {{name}}"
   */
  template?: string;
  /**
   * `--template-file <path>`: Read the template from a file, or from stdin
   * when the path is `-`.
   *
   * @example "./prompts/greeting.txt"
   */
  templateFile?: string;
  /**
   * `--model-provider <provider>`: Model provider for the prompt version.
   * Defaults to `OPENAI`.
   *
   * @example "GOOGLE"
   */
  modelProvider?: string;
  /**
   * `--model-name <name>`: Model name for the prompt version. Optional for
   * `OPENAI`, where it defaults to the playground's default model; required
   * for every other provider.
   *
   * @example "gpt-4o"
   */
  modelName?: string;
  /**
   * `--max-tokens <number>`: Maximum tokens the model may generate, saved as
   * the provider's max-tokens invocation parameter. Required for `ANTHROPIC`.
   * `NaN` when the value is not a positive integer.
   *
   * @example 1024
   */
  maxTokens?: number;
  /**
   * `--template-format <format>`: How variables are written in the template
   * — `MUSTACHE` (`{{name}}`), `F_STRING` (`{name}`), or `NONE`. Defaults to
   * `MUSTACHE`.
   *
   * @example "F_STRING"
   */
  templateFormat?: string;
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
 * Read the template from `--template` or `--template-file`, requiring
 * exactly one of them and a non-empty result.
 */
function readPromptTemplate(options: PromptCreateOptions): string {
  if (options.template !== undefined && options.templateFile !== undefined) {
    throw new InvalidArgumentError(
      `Pass either --template or --template-file, not both.\n${PROMPT_CREATE_USAGE}`
    );
  }
  let template: string;
  if (options.template !== undefined) {
    template = options.template;
  } else if (options.templateFile !== undefined) {
    const source = options.templateFile === "-" ? 0 : options.templateFile;
    try {
      template = fs.readFileSync(source, "utf8");
    } catch (error) {
      throw new InvalidArgumentError(
        `Could not read template file "${options.templateFile}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    throw new InvalidArgumentError(
      `Missing required flag --template or --template-file.\n${PROMPT_CREATE_USAGE}`
    );
  }
  if (template.trim() === "") {
    throw new InvalidArgumentError("Template is empty.");
  }
  return template;
}

/**
 * Turn the create flags into the prompt version body for `POST /v1/prompts`.
 * @param params - the flags and the template they resolved to
 * @param params.options - parsed `px prompt create` flags
 * @param params.template - template text, saved as a single user message
 */
function buildPromptVersion({
  options,
  template,
}: {
  options: PromptCreateOptions;
  template: string;
}): componentsV1["schemas"]["PromptVersionData"] {
  const modelProvider = (options.modelProvider ?? "OPENAI").toUpperCase();
  if (
    !CREATABLE_MODEL_PROVIDERS.includes(modelProvider as CreatableModelProvider)
  ) {
    throw new InvalidArgumentError(
      `Unsupported --model-provider "${options.modelProvider}". Use one of: ${CREATABLE_MODEL_PROVIDERS.join(", ")}.`
    );
  }
  const templateFormat = (options.templateFormat ?? "MUSTACHE").toUpperCase();
  if (!TEMPLATE_FORMATS.includes(templateFormat as PromptTemplateFormat)) {
    throw new InvalidArgumentError(
      `Unsupported --template-format "${options.templateFormat}". Use one of: ${TEMPLATE_FORMATS.join(", ")}.`
    );
  }
  const provider = modelProvider as CreatableModelProvider;
  if (options.maxTokens !== undefined && Number.isNaN(options.maxTokens)) {
    throw new InvalidArgumentError(
      "--max-tokens must be a positive integer, e.g. --max-tokens 1024."
    );
  }
  if (provider === "ANTHROPIC" && options.maxTokens === undefined) {
    throw new InvalidArgumentError(
      "--max-tokens is required for --model-provider ANTHROPIC.\n" +
        "  px prompt create --name <name> --template <text> --model-provider ANTHROPIC --model-name <model> --max-tokens 1024"
    );
  }
  const modelName =
    options.modelName ??
    (provider === "OPENAI" ? DEFAULT_OPENAI_MODEL_NAME : undefined);
  if (modelName === undefined) {
    throw new InvalidArgumentError(
      `--model-name is required for --model-provider ${provider}.\n` +
        `  px prompt create --name <name> --template <text> --model-provider ${provider} --model-name <model>`
    );
  }
  const invocationParameters =
    options.maxTokens === undefined
      ? undefined
      : { [MAX_TOKENS_PARAMETER[provider]]: options.maxTokens };
  // TypeScript can't narrow the provider union from a runtime string.
  return promptVersion({
    modelProvider: provider,
    modelName,
    templateFormat: templateFormat as PromptTemplateFormat,
    template: [{ role: "user", content: template }],
    invocationParameters,
  } as PromptVersionInput);
}

/**
 * Fetch the latest version of the prompt named `promptName`, or `null` when
 * no prompt has that name.
 * @param params - the lookup
 * @param params.client - Phoenix API client
 * @param params.promptName - name of the prompt to look up
 */
async function fetchLatestPromptVersionIfExists({
  client,
  promptName,
}: {
  client: PhoenixClient;
  promptName: string;
}): Promise<PromptVersion | null> {
  try {
    const response = await client.GET(
      "/v1/prompts/{prompt_identifier}/latest",
      {
        params: { path: { prompt_identifier: promptName } },
      }
    );
    return response.data?.data ?? null;
  } catch (error) {
    // Only a 404 means the prompt is missing; rethrow every other failure.
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Handler for `prompt create`
 */
async function promptCreateHandler(
  options: PromptCreateOptions
): Promise<void> {
  try {
    if (!options.name) {
      throw new InvalidArgumentError(
        `Missing required flag --name.\n${PROMPT_CREATE_USAGE}`
      );
    }
    if (!PROMPT_NAME_PATTERN.test(options.name)) {
      throw new InvalidArgumentError(
        `Invalid --name "${options.name}": use lowercase letters, digits, - or _, starting and ending with a letter or digit.\n` +
          "  px prompt create --name my-prompt --template <text>"
      );
    }
    const template = readPromptTemplate(options);
    const version = buildPromptVersion({ options, template });

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

    if (options.ifNotExists) {
      const existing = await fetchLatestPromptVersionIfExists({
        client,
        promptName: options.name,
      });
      if (existing) {
        writeProgress({
          message: `Prompt "${options.name}" already exists; printing its latest version ${existing.id}`,
          noProgress: !options.progress,
        });
        writeOutput({
          message: formatPromptOutput({
            promptVersion: existing,
            format: options.format,
          }),
        });
        return;
      }
    }

    writeProgress({
      message: `Creating prompt "${options.name}"...`,
      noProgress: !options.progress,
    });

    const response = await client.POST("/v1/prompts", {
      body: {
        prompt: {
          name: options.name,
          description: options.description,
        },
        version,
      },
    });

    if (!response.data) {
      throw new Error("Failed to create prompt: empty response from server");
    }

    writeProgress({
      message: `Created prompt version ${response.data.data.id}`,
      noProgress: !options.progress,
    });

    writeOutput({
      message: formatPromptOutput({
        promptVersion: response.data.data,
        format: options.format,
      }),
    });
  } catch (error) {
    writeError({
      message: `Error creating prompt: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

export function createPromptCreateCommand(): Command {
  return new Command("create")
    .description(
      "Create a prompt, or add a new version if the name already exists"
    )
    .option("--name <name>", "Prompt name (required)")
    .option(
      "--if-not-exists",
      "If the prompt already exists, print its latest version instead of adding one"
    )
    .option("--template <text>", "Template text, sent as a user message")
    .option(
      "--template-file <path>",
      "Read the template from a file, or from stdin with -"
    )
    .option(
      "--description <description>",
      "Prompt description (only applied when the prompt is new)"
    )
    .option(
      "--model-provider <provider>",
      `Model provider: ${CREATABLE_MODEL_PROVIDERS.join(", ")}`,
      "OPENAI"
    )
    .option(
      "--model-name <name>",
      `Model name (required unless the provider is OPENAI, which defaults to ${DEFAULT_OPENAI_MODEL_NAME})`
    )
    .option(
      "--max-tokens <number>",
      "Maximum tokens to generate (required for ANTHROPIC)",
      parsePositiveIntOption
    )
    .option(
      "--template-format <format>",
      "Template variable syntax: MUSTACHE, F_STRING, or NONE",
      "MUSTACHE"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--format <format>",
      "Output format: pretty, json, raw, or text",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  # Create a prompt from inline text\n" +
        "  px prompt create --name greeting --template 'Hello {{name}}'\n\n" +
        "  # Read the template from a file and pick the model\n" +
        "  px prompt create --name summarizer --template-file ./summarize.txt --model-name gpt-4o\n\n" +
        "  # Target Anthropic, which requires --max-tokens\n" +
        "  px prompt create --name greeting --template 'Hello {{name}}' --model-provider ANTHROPIC --model-name claude-sonnet-5-5 --max-tokens 1024\n\n" +
        "  # Pipe the template in and capture the version ID; safe to re-run (agent-friendly)\n" +
        "  cat summarize.txt | px prompt create --name summarizer --template-file - --if-not-exists --format raw --no-progress | jq -r '.id'\n\n" +
        "If a prompt named <name> already exists, the template is saved as its new latest version, unless --if-not-exists is passed.\n"
    )
    .action(promptCreateHandler);
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
  command.addCommand(createPromptCreateCommand());
  command.addCommand(createPromptDeleteCommand());
  return command;
}
