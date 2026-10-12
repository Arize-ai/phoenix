import { HttpError } from "@arizeai/phoenix-client";
import { password } from "@clack/prompts";
import { Command } from "commander";

import { isCancelled } from "../clackCancel";
import { createPhoenixClient } from "../client";
import {
  getConfigErrorMessage,
  resolveConfig,
  validateConfig,
} from "../config";
import { assertDeletesEnabled, confirmOrExit } from "../confirm";
import {
  AuthRequiredError,
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { collectString } from "../optionParsers";
import { writeStructuredError } from "../structuredError";
import {
  formatSecretKeysLine,
  formatSecretsResultOutput,
  type OutputFormat,
  type SecretsResult,
} from "./formatSecrets";
import type {
  CommonOptions,
  ConnectionOptions,
  DeleteOptions,
} from "./options";
import {
  mergeSecretEntries,
  parseSecretEnvFile,
  readValueSource,
  redactSecretValues,
  type SecretEntry,
  STDIN_PATH,
  stripTrailingNewline,
  validateSecretKey,
} from "./secretInput";

/**
 * Options for `px secret set`.
 *
 * There is deliberately no `--value <value>` flag: a value in argv is
 * recorded in shell history and visible to every user on the host via `ps`.
 * Values come only from stdin, a file, the environment, or a dotenv file, and
 * all sources are combined into one atomic `PUT /v1/secrets`.
 */
interface SecretSetOptions extends CommonOptions<OutputFormat> {
  /**
   * `--value-file <path>`: Read the value for the positional `<key>` from a
   * file, or from stdin when the path is `-`. One trailing newline is
   * stripped.
   *
   * @example "./openai.key"
   */
  valueFile?: string;
  /**
   * `--from-env <NAME>`: Upsert a secret named `NAME` with the value of the
   * environment variable `NAME` in the CLI's own environment. Repeatable.
   * Only the variable *name* appears on the command line.
   *
   * @example ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
   */
  fromEnv?: string[];
  /**
   * `--env-file <path>`: Upsert every `KEY=value` line of a dotenv-style
   * file, or of stdin when the path is `-`. Repeatable.
   *
   * @example ["./secrets.env"]
   */
  envFile?: string[];
}

/**
 * Options for `px secret delete`. The keys to delete are positional; like
 * every other delete verb there is no `--format`.
 */
type SecretDeleteOptions = DeleteOptions;

/**
 * Process-level collaborators of the `secret` commands, injectable so tests
 * can drive the stdin and hidden-prompt paths without a terminal.
 */
export interface SecretCommandDeps {
  /** Where piped values are read from. Defaults to `process.stdin`. */
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
  /**
   * Masked interactive prompt used when a value is expected on stdin but
   * stdin is a terminal. Resolves `null` when the user cancels.
   */
  promptHiddenValue?: (message: string) => Promise<string | null>;
}

/** Raised when the user cancels the hidden prompt; maps to `CANCELLED`. */
class PromptCancelledError extends Error {
  constructor() {
    super("Operation cancelled");
    this.name = "PromptCancelledError";
  }
}

async function defaultPromptHiddenValue(
  message: string
): Promise<string | null> {
  const value = await password({ message });
  return isCancelled(value) ? null : value;
}

function resolveDeps(
  deps: SecretCommandDeps = {}
): Required<SecretCommandDeps> {
  return {
    stdin: deps.stdin ?? process.stdin,
    promptHiddenValue: deps.promptHiddenValue ?? defaultPromptHiddenValue,
  };
}

/** `ExitCode` value → constant name, for the `{error, code}` envelope. */
const EXIT_CODE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(ExitCode).map(([name, code]) => [code, name])
);

/**
 * Write a redacted error and exit with the code inferred from `error`.
 * Every submitted value is scrubbed from the message first; the primary
 * defence is that no message built in this module ever contains one.
 */
function exitWithSecretError({
  context,
  error,
  format,
  values,
}: {
  context: string;
  error: unknown;
  format: OutputFormat | undefined;
  values: Iterable<string | null | undefined>;
}): never {
  if (error instanceof PromptCancelledError) {
    writeError({ message: error.message });
    process.exit(ExitCode.CANCELLED);
  }
  const exitCode = getExitCodeForError(error);
  const detail = error instanceof Error ? error.message : String(error);
  writeStructuredError({
    format,
    message: redactSecretValues(`${context}: ${detail}`, values),
    code: EXIT_CODE_NAMES[exitCode] ?? "FAILURE",
  });
  process.exit(exitCode);
}

/**
 * Translate a non-2xx answer from `PUT /v1/secrets` into a CLI error whose
 * message is built from the status alone. Server validation text can
 * reflect the submitted payload, so the response body is never surfaced.
 */
function toSecretsRequestError(error: unknown): unknown {
  if (!(error instanceof HttpError)) {
    return error;
  }
  switch (error.status) {
    case 401:
    case 403:
      return new AuthRequiredError(
        `Managing secrets requires an admin API key (HTTP ${error.status})`
      );
    case 422:
      return new InvalidArgumentError(
        "The server rejected the secrets batch (HTTP 422): check that every key is valid and no value is empty"
      );
    case 507:
      return new Error(
        "The server could not store the secrets (HTTP 507 Insufficient Storage)"
      );
    default:
      return new Error(`Phoenix responded with HTTP ${error.status}`);
  }
}

/**
 * Send one atomic `PUT /v1/secrets`. The result names affected keys only.
 */
async function putSecrets(
  options: ConnectionOptions,
  secrets: SecretEntry[]
): Promise<SecretsResult> {
  const config = resolveConfig({
    cliOptions: {
      endpoint: options.endpoint,
      apiKey: options.apiKey,
    },
  });

  const validation = validateConfig({ config, projectRequired: false });
  if (!validation.valid) {
    throw new InvalidArgumentError(
      getConfigErrorMessage({ errors: validation.errors })
    );
  }

  const client = createPhoenixClient({ config });

  try {
    const response = await client.PUT("/v1/secrets", { body: { secrets } });
    if (response.error || !response.data) {
      throw new Error("no result returned by the server");
    }
    return response.data.data;
  } catch (error) {
    throw toSecretsRequestError(error);
  }
}

/**
 * Number of inputs that would consume stdin. More than one cannot work — the
 * first reader drains the stream — so it is rejected up front.
 */
function countStdinReaders(
  key: string | undefined,
  options: SecretSetOptions
): number {
  let readers = (options.envFile ?? []).filter(
    (path) => path === STDIN_PATH
  ).length;
  if (key !== undefined) {
    if (options.valueFile === undefined || options.valueFile === STDIN_PATH) {
      readers += 1;
    }
  }
  return readers;
}

/**
 * Gather every upsert entry from the configured sources, in ascending
 * precedence (`--env-file`, then `--from-env`, then the positional key) so
 * that after `mergeSecretEntries` the most explicit source wins.
 *
 * Each value is pushed to `values` the moment it is read, so an error later
 * in collection still has the full list to redact against.
 */
async function collectUpsertEntries({
  key,
  options,
  deps,
  values,
}: {
  key: string | undefined;
  options: SecretSetOptions;
  deps: Required<SecretCommandDeps>;
  values: string[];
}): Promise<SecretEntry[]> {
  const entries: SecretEntry[] = [];

  for (const path of options.envFile ?? []) {
    const sourceName = path === STDIN_PATH ? "stdin" : path;
    const contents = await readValueSource({ path, stdin: deps.stdin });
    const parsed = parseSecretEnvFile(contents, sourceName);
    for (const entry of parsed) {
      if (entry.value !== null) {
        values.push(entry.value);
      }
    }
    entries.push(...parsed);
  }

  for (const name of options.fromEnv ?? []) {
    const envKey = validateSecretKey(name, "--from-env");
    const value = process.env[envKey];
    if (value === undefined || value.length === 0) {
      throw new InvalidArgumentError(
        `Environment variable ${envKey} is not set or is empty`
      );
    }
    values.push(value);
    entries.push({ key: envKey, value });
  }

  if (key !== undefined) {
    const validKey = validateSecretKey(key, "argument 1");
    let rawValue: string;
    if (options.valueFile !== undefined) {
      rawValue = await readValueSource({
        path: options.valueFile,
        stdin: deps.stdin,
      });
    } else if (deps.stdin.isTTY) {
      const prompted = await deps.promptHiddenValue(
        `Enter the value for ${validKey} (input is hidden)`
      );
      if (prompted === null) {
        throw new PromptCancelledError();
      }
      rawValue = prompted;
    } else {
      rawValue = await readValueSource({
        path: STDIN_PATH,
        stdin: deps.stdin,
      });
    }
    const value = stripTrailingNewline(rawValue);
    if (value.length > 0) {
      values.push(value);
    }
    if (value.trim().length === 0) {
      throw new InvalidArgumentError(
        `Secret value for ${validKey} is empty. To delete a secret use: px secret delete ${validKey}`
      );
    }
    entries.push({ key: validKey, value });
  }

  return mergeSecretEntries(entries);
}

/**
 * Handler for `secret set`
 */
async function secretSetHandler(
  key: string | undefined,
  options: SecretSetOptions,
  deps: Required<SecretCommandDeps>
): Promise<void> {
  // Argument-shape validation runs before the try block so its `process.exit`
  // isn't caught and re-mapped by the catch-all error handler below.
  const hasBatchSource =
    (options.fromEnv?.length ?? 0) > 0 || (options.envFile?.length ?? 0) > 0;
  if (key === undefined && !hasBatchSource) {
    writeStructuredError({
      format: options.format,
      message:
        "Nothing to set: pass a <key> (value read from stdin or --value-file), --from-env, or --env-file",
      code: "INVALID_ARGUMENT",
      hint: "printf '%s' \"$OPENAI_API_KEY\" | px secret set OPENAI_API_KEY",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (key === undefined && options.valueFile !== undefined) {
    writeStructuredError({
      format: options.format,
      message: "--value-file requires a <key> argument",
      code: "INVALID_ARGUMENT",
      hint: "px secret set OPENAI_API_KEY --value-file ./openai.key",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (countStdinReaders(key, options) > 1) {
    writeStructuredError({
      format: options.format,
      message:
        "stdin can supply only one input: use --value-file <path> or --env-file <path> for the others",
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Every value read so far, for redacting error text. Never printed.
  const values: string[] = [];
  try {
    const entries = await collectUpsertEntries({ key, options, deps, values });

    writeProgress({
      message: formatSecretKeysLine(
        "Upserting",
        entries.map((entry) => entry.key)
      ),
      noProgress: !options.progress,
    });

    const result = await putSecrets(options, entries);

    writeOutput({
      message: formatSecretsResultOutput({ result, format: options.format }),
    });
  } catch (error) {
    exitWithSecretError({
      context: "Error setting secrets",
      error,
      format: options.format,
      values,
    });
  }
}

/**
 * Handler for `secret delete`
 */
async function secretDeleteHandler(
  rawKeys: string[],
  options: SecretDeleteOptions
): Promise<void> {
  try {
    assertDeletesEnabled();

    const keys = [
      ...new Set(
        rawKeys.map((rawKey, index) =>
          validateSecretKey(rawKey, `argument ${index + 1}`)
        )
      ),
    ];

    await confirmOrExit({
      message: `Delete ${keys.length} secret(s) (${keys.join(", ")})? This cannot be undone.`,
      yes: options.yes,
    });

    const result = await putSecrets(
      options,
      keys.map((key) => ({ key, value: null }))
    );

    writeProgress({
      message: formatSecretKeysLine("Deleted", result.deleted_keys),
      noProgress: !options.progress,
    });
  } catch (error) {
    writeError({
      message: `Error deleting secrets: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the `secret` command with subcommands
 */
export function createSecretCommand(deps: SecretCommandDeps = {}): Command {
  const command = new Command("secret");
  command.description(
    "Manage Phoenix secrets (encrypted LLM provider credentials; admin only)"
  );

  command.addCommand(createSecretSetCommand(deps));
  command.addCommand(createSecretDeleteCommand());

  return command;
}

export function createSecretSetCommand(deps: SecretCommandDeps = {}): Command {
  const resolved = resolveDeps(deps);
  return new Command("set")
    .alias("upsert")
    .description(
      "Create or update secrets atomically; values are read from stdin, a file, or the environment — never from the command line"
    )
    .argument(
      "[key]",
      "Secret key to set, e.g. OPENAI_API_KEY (value read from stdin unless --value-file is given)"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option(
      "--value-file <path>",
      "Read the value for <key> from a file ('-' for stdin)"
    )
    .option(
      "--from-env <NAME>",
      "Set the secret NAME to the value of the environment variable NAME (repeatable)",
      collectString,
      []
    )
    .option(
      "--env-file <path>",
      "Set every KEY=value line of a dotenv file ('-' for stdin; repeatable)",
      collectString,
      []
    )
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nSECURITY: secret values are never accepted as a command-line argument or flag. Anything in argv is\n" +
        "recorded in shell history and visible to other users through `ps` and CI logs. Provide values on\n" +
        "stdin, from a file (--value-file), from the environment by name (--from-env), or from a dotenv file\n" +
        "(--env-file). All sources are sent in one atomic request; if the same key appears more than once,\n" +
        "the positional key wins over --from-env, which wins over --env-file. Output names affected keys only.\n" +
        "Requires an admin API key.\n" +
        "\nExamples:\n" +
        "  # Read the value from stdin (nothing is echoed; a trailing newline is stripped)\n" +
        "  printf '%s' \"$OPENAI_API_KEY\" | px secret set OPENAI_API_KEY\n\n" +
        "  # Prompt for the value with hidden input (interactive terminals)\n" +
        "  px secret set OPENAI_API_KEY\n\n" +
        "  # Read the value from a file (keep the file mode 0600)\n" +
        "  px secret set ANTHROPIC_API_KEY --value-file ./anthropic.key\n\n" +
        "  # Copy secrets from the current environment by name (values never touch argv)\n" +
        "  px secret set --from-env OPENAI_API_KEY --from-env ANTHROPIC_API_KEY\n\n" +
        "  # Provision a whole batch atomically from a dotenv file and list the keys written (agent-friendly)\n" +
        "  px secret set --env-file ./secrets.env --format raw --no-progress | jq -r '.upserted_keys[]'\n"
    )
    .action((key: string | undefined, options: SecretSetOptions) =>
      secretSetHandler(key, options, resolved)
    );
}

export function createSecretDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete secrets atomically by key")
    .argument("<keys...>", "One or more secret keys, e.g. OPENAI_API_KEY")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--no-progress", "Disable progress indicators")
    .addHelpText(
      "after",
      "\nDeletes are disabled unless PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true is set.\n" +
        "All keys are removed in one atomic request; deleting a key that does not exist succeeds silently.\n" +
        "Requires an admin API key.\n" +
        "\nExamples:\n" +
        "  # Delete one secret with an interactive confirmation prompt\n" +
        "  px secret delete OPENAI_API_KEY\n\n" +
        "  # Delete several secrets atomically, skipping the prompt (for scripts and agents)\n" +
        "  px secret delete OPENAI_API_KEY ANTHROPIC_API_KEY --yes\n"
    )
    .action(secretDeleteHandler);
}
