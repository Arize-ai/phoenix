import * as fs from "fs";
import {
  type componentsV1,
  formatApiError,
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
import { collectString } from "../optionParsers";
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
type PromptVersionData = componentsV1["schemas"]["PromptVersionData"];
type PromptMessage = componentsV1["schemas"]["PromptMessage"];
type PromptTemplateFormat = componentsV1["schemas"]["PromptTemplateFormat"];
type CreatePromptRequestBody =
  componentsV1["schemas"]["CreatePromptRequestBody"];

/**
 * Default model for `OPENAI` when `--model-name` is omitted. Mirrors
 * `DEFAULT_MODEL_NAME` in the app's `generativeConstants.ts`.
 */
const DEFAULT_OPENAI_MODEL_NAME = "gpt-5.6-luna";

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
 * Mirrors the server's `Identifier` constraint on tag and prompt names, so
 * invalid names fail locally with usage instead of as an opaque 422.
 */
const IDENTIFIER_PATTERN = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

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
    if (!IDENTIFIER_PATTERN.test(options.tag)) {
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

/**
 * Options for `px prompt create`. The version comes from `--file`, from the
 * message flags, or from both; flags override the matching fields of the file.
 */
interface PromptCreateOptions extends CommonOptions<OutputFormat> {
  /**
   * `--name <name>`: Name of the prompt. If a prompt with this name already
   * exists, the version is added as its new latest version unless
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
   * `--file <path>`: A `PromptVersionData` JSON document, or `-` for stdin.
   * The output of `px prompt get --format json` works unchanged; `id` and
   * `created_at` are ignored. Missing fields come from flags and defaults.
   *
   * @example "./greeting.json"
   */
  file?: string;
  /**
   * `--system <text>`: A system message, placed before every other message.
   *
   * @example "You are a helpful assistant."
   */
  system?: string;
  /**
   * `--messages-file <path>`: A JSON array of messages, or `-` for stdin.
   * Placed after `--system`.
   *
   * @example "./messages.json"
   */
  messagesFile?: string;
  /**
   * `--message <role>=<text>`: Repeatable. One message per flag, kept in the
   * order given, after `--messages-file`.
   *
   * @example ["user=What is {{topic}}?", "assistant=Let me explain."]
   */
  message: string[];
  /**
   * `--template <text>`: A single user message, placed after every other
   * message.
   *
   * @example "Hello {{name}}"
   */
  template?: string;
  /**
   * `--template-file <path>`: Same as `--template`, read from a file or from
   * stdin when the path is `-`.
   *
   * @example "./greeting.txt"
   */
  templateFile?: string;
  /**
   * `--model-provider <provider>`: Model provider. Defaults to the file's
   * provider, then `OPENAI`.
   *
   * @example "ANTHROPIC"
   */
  modelProvider?: string;
  /**
   * `--model-name <name>`: Model name. Defaults to the file's model when the
   * provider is unchanged, then to the playground's default model for
   * `OPENAI`. Required in every other case.
   *
   * @example "claude-sonnet-5-5"
   */
  modelName?: string;
  /**
   * `--invocation-parameters <json>`: A JSON object of the provider's
   * invocation parameters, merged over the file's.
   *
   * @example '{"temperature": 0.2, "max_tokens": 1024}'
   */
  invocationParameters?: string;
  /**
   * `--param <key=value>`: Repeatable. One invocation parameter per flag,
   * merged over `--invocation-parameters`. The value is parsed as JSON and
   * falls back to a plain string.
   *
   * @example ["temperature=0.2", "stop=[\"\\n\"]"]
   */
  param: string[];
  /**
   * `--tools-file <path>`: A `PromptTools` JSON object, or a bare JSON array
   * of tools, or `-` for stdin.
   *
   * @example "./tools.json"
   */
  toolsFile?: string;
  /**
   * `--response-format-file <path>`: A `PromptResponseFormatJSONSchema` JSON
   * object, or `-` for stdin.
   *
   * @example "./response-format.json"
   */
  responseFormatFile?: string;
  /**
   * `--template-format <format>`: How variables are written — `MUSTACHE`
   * (`{{name}}`), `F_STRING` (`{name}`), or `NONE`. Defaults to the file's
   * format, then `MUSTACHE`.
   *
   * @example "F_STRING"
   */
  templateFormat?: string;
  /**
   * `--description <text>`: Description of the version, and of the prompt
   * when the prompt is new.
   *
   * @example "Says hello to the user"
   */
  description?: string;
  /**
   * `--metadata <json>`: A JSON object stored on the prompt. Like the prompt
   * description, the server only applies it when the prompt is new.
   *
   * @example '{"team": "support"}'
   */
  metadata?: string;
}

const PROMPT_CREATE_USAGE =
  "  px prompt create --name <name> --template <text>\n" +
  "  px prompt create --name <name> --file <path|->";

const MESSAGE_ROLES: readonly PromptMessage["role"][] = [
  "system",
  "developer",
  "user",
  "assistant",
  "model",
  "ai",
  "tool",
];

/**
 * Read a flag's file argument as text, or stdin when the argument is `-`.
 * Stdin is read as a stream so a pipe from a slower command, such as
 * `px prompt get`, is read in full instead of failing with `EAGAIN`.
 * @param params - the flag and its argument
 * @param params.flag - flag name, used in the error message
 * @param params.source - file path, or `-` for stdin
 */
async function readTextSource({
  flag,
  source,
}: {
  flag: string;
  source: string;
}): Promise<string> {
  try {
    if (source !== "-") {
      return fs.readFileSync(source, "utf8");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    throw new InvalidArgumentError(
      `Could not read ${flag} "${source}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse a flag's value as JSON.
 * @param params - the flag and its text
 * @param params.flag - flag name, used in the error message
 * @param params.text - JSON text
 */
function parseJsonFlag({
  flag,
  text,
}: {
  flag: string;
  text: string;
}): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InvalidArgumentError(
      `${flag} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Read a flag's file argument, or stdin when it is `-`, and parse it as JSON.
 * @param params - the flag and its argument
 * @param params.flag - flag name, used in error messages
 * @param params.source - file path, or `-` for stdin
 */
async function readJsonFileFlag({
  flag,
  source,
}: {
  flag: string;
  source: string;
}): Promise<unknown> {
  return parseJsonFlag({ flag, text: await readTextSource({ flag, source }) });
}

/**
 * Parse a flag's value as a JSON object.
 * @param params - the flag and its text
 * @param params.flag - flag name, used in the error message
 * @param params.text - JSON text
 */
function parseJsonObjectFlag({
  flag,
  text,
}: {
  flag: string;
  text: string;
}): Record<string, unknown> {
  const value = parseJsonFlag({ flag, text });
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidArgumentError(`${flag} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Split a `key=value` flag at its first `=`.
 * @param params - the flag and its value
 * @param params.flag - flag name, used in the error message
 * @param params.value - the `key=value` text
 * @param params.example - a valid value, shown in the error message
 */
function splitKeyValue({
  flag,
  value,
  example,
}: {
  flag: string;
  value: string;
  example: string;
}): [string, string] {
  const index = value.indexOf("=");
  if (index <= 0) {
    throw new InvalidArgumentError(
      `Invalid ${flag} "${value}": expected <key>=<value>, e.g. ${flag} ${example}`
    );
  }
  return [value.slice(0, index).trim(), value.slice(index + 1)];
}

/**
 * Collect the messages given by flags, in the documented order: `--system`,
 * `--messages-file`, each `--message`, then `--template`/`--template-file`.
 * Returns `undefined` when no message flag is passed.
 */
async function buildMessagesFromFlags(
  options: PromptCreateOptions
): Promise<PromptMessage[] | undefined> {
  if (options.template !== undefined && options.templateFile !== undefined) {
    throw new InvalidArgumentError(
      `Pass either --template or --template-file, not both.\n${PROMPT_CREATE_USAGE}`
    );
  }
  const messages: PromptMessage[] = [];
  if (options.system !== undefined) {
    messages.push({ role: "system", content: options.system });
  }
  if (options.messagesFile !== undefined) {
    const parsed = await readJsonFileFlag({
      flag: "--messages-file",
      source: options.messagesFile,
    });
    if (!Array.isArray(parsed)) {
      throw new InvalidArgumentError(
        "--messages-file must contain a JSON array of messages."
      );
    }
    messages.push(...(parsed as PromptMessage[]));
  }
  for (const messageFlag of options.message) {
    const [role, content] = splitKeyValue({
      flag: "--message",
      value: messageFlag,
      example: '"user=Hello {{name}}"',
    });
    if (!MESSAGE_ROLES.includes(role as PromptMessage["role"])) {
      throw new InvalidArgumentError(
        `Invalid --message role "${role}". Use one of: ${MESSAGE_ROLES.join(", ")}.`
      );
    }
    messages.push({ role: role as PromptMessage["role"], content });
  }
  const template =
    options.templateFile !== undefined
      ? await readTextSource({
          flag: "--template-file",
          source: options.templateFile,
        })
      : options.template;
  if (template !== undefined) {
    if (template.trim() === "") {
      throw new InvalidArgumentError("Template is empty.");
    }
    messages.push({ role: "user", content: template });
  }
  return messages.length > 0 ? messages : undefined;
}

/**
 * Merge the file's invocation parameters with `--invocation-parameters` and
 * each `--param`, and wrap them for the provider. Field names are not checked
 * here; the server validates them against the provider.
 * @param params - the merge inputs
 * @param params.provider - the version's model provider
 * @param params.fromFile - the file's `invocation_parameters`, if any
 * @param params.options - parsed `px prompt create` flags
 */
function buildInvocationParameters({
  provider,
  fromFile,
  options,
}: {
  provider: string;
  fromFile: PromptVersionData["invocation_parameters"] | undefined;
  options: PromptCreateOptions;
}): PromptVersionData["invocation_parameters"] {
  const fileFields = fromFile
    ? ((fromFile as unknown as Record<string, Record<string, unknown>>)[
        fromFile.type
      ] ?? {})
    : {};
  const flagFields =
    options.invocationParameters === undefined
      ? {}
      : parseJsonObjectFlag({
          flag: "--invocation-parameters",
          text: options.invocationParameters,
        });
  const paramFields = Object.fromEntries(
    options.param.map((param) => {
      const [key, value] = splitKeyValue({
        flag: "--param",
        value: param,
        example: "temperature=0.2",
      });
      try {
        return [key, JSON.parse(value)];
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
        // A bare word such as `fast` is meant as a string.
        return [key, value];
      }
    })
  );
  const type = provider.toLowerCase();
  // The provider is a runtime string, so TypeScript can't pick the union member.
  return {
    type,
    [type]: { ...fileFields, ...flagFields, ...paramFields },
  } as unknown as PromptVersionData["invocation_parameters"];
}

/**
 * Pick the model provider and name: flags first, then the file, then the
 * `OPENAI` default. The file's model name is only reused when the provider is
 * unchanged.
 * @param params - the inputs
 * @param params.options - parsed `px prompt create` flags
 * @param params.fromFile - fields read from `--file`
 */
function resolveModel({
  options,
  fromFile,
}: {
  options: PromptCreateOptions & { name: string };
  fromFile: Partial<PromptVersionData>;
}): { provider: string; modelName: string } {
  const provider =
    options.modelProvider?.toUpperCase() ?? fromFile.model_provider ?? "OPENAI";
  const fileModelName =
    provider === fromFile.model_provider ? fromFile.model_name : undefined;
  const modelName =
    options.modelName ??
    fileModelName ??
    (provider === "OPENAI" ? DEFAULT_OPENAI_MODEL_NAME : undefined);
  if (modelName === undefined) {
    throw new InvalidArgumentError(
      `--model-name is required for --model-provider ${provider}.\n` +
        `  px prompt create --name ${options.name} --template <text> --model-provider ${provider} --model-name <model>`
    );
  }
  return { provider, modelName };
}

/**
 * Read `--tools-file` and `--response-format-file`, falling back to the
 * file's fields. A bare array of tools is wrapped as a `PromptTools` object.
 * @param params - the inputs
 * @param params.options - parsed `px prompt create` flags
 * @param params.fromFile - fields read from `--file`
 */
async function readToolsAndResponseFormat({
  options,
  fromFile,
}: {
  options: PromptCreateOptions;
  fromFile: Partial<PromptVersionData>;
}): Promise<Pick<PromptVersionData, "tools" | "response_format">> {
  const toolsFromFlag =
    options.toolsFile === undefined
      ? undefined
      : await readJsonFileFlag({
          flag: "--tools-file",
          source: options.toolsFile,
        });
  const tools = Array.isArray(toolsFromFlag)
    ? ({ type: "tools", tools: toolsFromFlag } as PromptVersionData["tools"])
    : ((toolsFromFlag as PromptVersionData["tools"]) ?? fromFile.tools);
  const responseFormat =
    options.responseFormatFile === undefined
      ? fromFile.response_format
      : ((await readJsonFileFlag({
          flag: "--response-format-file",
          source: options.responseFormatFile,
        })) as PromptVersionData["response_format"]);
  return { tools, response_format: responseFormat };
}

/**
 * Turn the create flags into the body for `POST /v1/prompts`.
 */
async function buildCreatePromptBody(
  options: PromptCreateOptions & { name: string }
): Promise<CreatePromptRequestBody> {
  const stdinFlags = [
    ["--file", options.file],
    ["--messages-file", options.messagesFile],
    ["--template-file", options.templateFile],
    ["--tools-file", options.toolsFile],
    ["--response-format-file", options.responseFormatFile],
  ]
    .filter(([, source]) => source === "-")
    .map(([flag]) => flag);
  if (stdinFlags.length > 1) {
    throw new InvalidArgumentError(
      `Only one flag can read from stdin (-), got: ${stdinFlags.join(", ")}.`
    );
  }

  const fromFile: Partial<PromptVersionData> =
    options.file === undefined
      ? {}
      : parseJsonObjectFlag({
          flag: "--file",
          text: await readTextSource({ flag: "--file", source: options.file }),
        });
  const messages = await buildMessagesFromFlags(options);
  if (messages === undefined && fromFile.template === undefined) {
    throw new InvalidArgumentError(
      `Missing a template: pass --file, --template, --template-file, --message, --messages-file, or --system.\n${PROMPT_CREATE_USAGE}`
    );
  }

  const { provider, modelName } = resolveModel({ options, fromFile });

  const version: PromptVersionData = {
    description: options.description ?? fromFile.description,
    metadata: fromFile.metadata,
    model_provider: provider as PromptVersionData["model_provider"],
    model_name: modelName,
    template: messages
      ? { type: "chat", messages }
      : (fromFile.template as PromptVersionData["template"]),
    template_type: messages ? "CHAT" : (fromFile.template_type ?? "CHAT"),
    template_format:
      (options.templateFormat?.toUpperCase() as
        | PromptTemplateFormat
        | undefined) ??
      fromFile.template_format ??
      "MUSTACHE",
    invocation_parameters: buildInvocationParameters({
      provider,
      fromFile: fromFile.invocation_parameters,
      options,
    }),
    ...(await readToolsAndResponseFormat({ options, fromFile })),
  };
  return {
    prompt: {
      name: options.name,
      description: options.description,
      metadata:
        options.metadata === undefined
          ? undefined
          : parseJsonObjectFlag({ flag: "--metadata", text: options.metadata }),
    },
    version,
  };
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
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Read the validation message from a 422 body. FastAPI sends `detail` as a
 * list of `{ loc, msg }` entries; anything else goes through `formatApiError`.
 */
async function readValidationDetail(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { detail?: unknown };
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((entry: { loc?: unknown[]; msg?: string }) => {
          // Pydantic repeats a tagged union's tag in `loc`
          // (`invocation_parameters.openai.openai.temperature`), so drop
          // a segment equal to the one before it.
          const location = (entry.loc ?? [])
            .filter(
              (part, index, parts) =>
                part !== "body" && part !== parts[index - 1]
            )
            .join(".");
          return location ? `${location}: ${entry.msg}` : String(entry.msg);
        })
        .join("; ");
    }
    return formatApiError(body);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return `${response.status} ${response.statusText}`;
  }
}

/**
 * Map a failed create to an exit code, a message, and a resolution hint. A
 * 422 carries the server's validation message, since field checks are left
 * to the server.
 */
async function classifyPromptCreateError(error: unknown): Promise<{
  exitCode: ExitCode;
  message: string;
  hint?: string;
}> {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) {
      return {
        exitCode: ExitCode.AUTH_REQUIRED,
        message,
        hint: "px auth status",
      };
    }
    if (error.status === 422) {
      return {
        exitCode: ExitCode.INVALID_ARGUMENT,
        message: `The server rejected the prompt version: ${await readValidationDetail(error.response)}`,
        hint: "px prompt create --help",
      };
    }
  }
  return { exitCode: getExitCodeForError(error), message };
}

/**
 * Handler for `prompt create`
 */
async function promptCreateHandler(
  options: PromptCreateOptions
): Promise<void> {
  try {
    const name = options.name;
    if (!name) {
      throw new InvalidArgumentError(
        `Missing required flag --name.\n${PROMPT_CREATE_USAGE}`
      );
    }
    if (!IDENTIFIER_PATTERN.test(name)) {
      throw new InvalidArgumentError(
        `Invalid value for --name: "${name}". Use lowercase letters, digits, "-" or "_", starting and ending with a letter or digit.\n` +
          "  px prompt create --name my-prompt --template <text>"
      );
    }
    const body = await buildCreatePromptBody({ ...options, name });

    const config = resolveConfig({ cliOptions: options });
    const validation = validateConfig({ config, projectRequired: false });
    if (!validation.valid) {
      throw new InvalidArgumentError(
        getConfigErrorMessage({ errors: validation.errors })
      );
    }
    const client = createPhoenixClient({ config });

    if (options.ifNotExists) {
      const existing = await fetchLatestPromptVersionIfExists({
        client,
        promptName: name,
      });
      if (existing) {
        writeProgress({
          message: `Prompt "${name}" already exists; printing its latest version ${existing.id}`,
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
      message: `Creating prompt "${name}"...`,
      noProgress: !options.progress,
    });
    const response = await client.POST("/v1/prompts", { body });
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
    const { exitCode, message, hint } = await classifyPromptCreateError(error);
    writeStructuredError({
      format: options.format === "text" ? "pretty" : options.format,
      message: `Error creating prompt: ${message}`,
      code:
        Object.entries(ExitCode).find(([, value]) => value === exitCode)?.[0] ??
        "FAILURE",
      hint,
    });
    process.exit(exitCode);
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
    .option(
      "--file <path>",
      "Prompt version JSON (e.g. from px prompt get --format json), or - for stdin"
    )
    .option("--system <text>", "System message, placed first")
    .option("--messages-file <path>", "JSON array of messages, or - for stdin")
    .option(
      "--message <role=text>",
      "Message as role=text, repeatable, kept in order",
      collectString,
      []
    )
    .option("--template <text>", "User message, placed last")
    .option(
      "--template-file <path>",
      "Read the user message from a file, or from stdin with -"
    )
    .option(
      "--model-provider <provider>",
      "Model provider, e.g. OPENAI, ANTHROPIC, GOOGLE (default: the file's, then OPENAI)"
    )
    .option(
      "--model-name <name>",
      `Model name (default: the file's, then ${DEFAULT_OPENAI_MODEL_NAME} for OPENAI)`
    )
    .option(
      "--invocation-parameters <json>",
      "Invocation parameters as a JSON object of the provider's fields, e.g. '{\"temperature\": 0}'"
    )
    .option(
      "--param <key=value>",
      "Invocation parameter, repeatable; sets a field inside invocation_parameters.<provider>, value parsed as JSON",
      collectString,
      []
    )
    .option(
      "--tools-file <path>",
      "Tools JSON: a tools object, or an array of function tools, or - for stdin"
    )
    .option(
      "--response-format-file <path>",
      "Response format JSON, or - for stdin"
    )
    .option(
      "--template-format <format>",
      "Template variable syntax: MUSTACHE, F_STRING, or NONE (default: the file's, then MUSTACHE)"
    )
    .option(
      "--description <text>",
      "Version description; also the prompt's when the prompt is new"
    )
    .option(
      "--metadata <json>",
      "Prompt metadata as a JSON object (applied when the prompt is new)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .addOption(
      new Option("--format <format>", "Output format")
        .choices(["pretty", "json", "raw", "text"])
        .default("pretty")
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      `
Examples:
  # One user message
  px prompt create --name greeting --template 'Hello {{name}}'

  # System and user messages with parameters
  px prompt create --name qa --system 'You answer briefly.' --template '{{question}}' \\
    --param temperature=0.2 --param max_tokens=512

  # Anthropic requires max_tokens
  px prompt create --name qa --model-provider ANTHROPIC --model-name claude-sonnet-5-5 \\
    --message 'user={{question}}' --param max_tokens=1024

  # Add a tool; tools.json holds [{"type": "function", "function": {"name": "lookup_order",
  #   "description": "Look up an order", "parameters": {"type": "object", "properties": {...}}}}]
  px prompt create --name qa --file qa.json --tools-file tools.json

  # Edit an existing prompt and save it as a new version
  px prompt get qa --format json --no-progress > qa.json
  px prompt create --name qa --file qa.json --param temperature=0

  # Agent-friendly: read from stdin, reuse the prompt if it exists
  cat qa.json | px prompt create --name qa --file - --if-not-exists --format raw --no-progress | jq -r '.id'

Message order: --system, --messages-file, each --message, then --template.
Any message flag replaces the messages from --file. Invocation parameters
merge in the order --file, --invocation-parameters, then each --param.

If a prompt named <name> already exists, the version is added as its new
latest version, unless --if-not-exists is passed. The server validates
providers and invocation parameters and reports any problem.`
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
  command.addCommand(createPromptTagCommand());
  command.addCommand(createPromptDeleteCommand());
  return command;
}
