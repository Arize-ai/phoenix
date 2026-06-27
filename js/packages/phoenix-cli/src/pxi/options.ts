import { Command } from "commander";

import { resolveConfig } from "../config";
import { InvalidArgumentError } from "../exitCodes";
import { loadSettings, saveSettings } from "../settings";
import type {
  BuiltInProvider,
  ModelSelection,
  PxiEditPermission,
  PxiRuntimeOptions,
} from "./types";

export const DEFAULT_PXI_PROVIDER: BuiltInProvider = "ANTHROPIC";
export const DEFAULT_PXI_MODEL = "claude-opus-4-8";

export const BUILT_IN_PROVIDERS = [
  "ANTHROPIC",
  "AWS",
  "AZURE_OPENAI",
  "CEREBRAS",
  "DEEPSEEK",
  "FIREWORKS",
  "GOOGLE",
  "GROQ",
  "MOONSHOT",
  "OLLAMA",
  "OPENAI",
  "PERPLEXITY",
  "TOGETHER",
  "XAI",
] as const satisfies readonly BuiltInProvider[];

type RawPxiOptions = {
  endpoint?: string;
  apiKey?: string;
  profile?: string;
  provider?: string;
  model?: string;
  customProviderId?: string;
  skipModelPreflight?: boolean;
  enableWebAccess?: boolean;
  enableSubagents?: boolean;
  enableGraphqlMutations?: boolean;
  bypassEdits?: boolean;
  ingestTraces?: boolean;
  exportRemoteTraces?: boolean;
  attachUserId?: boolean;
};

export type ResolvePxiRuntimeOptionsInput = {
  cliOptions: RawPxiOptions;
  sessionId?: string;
};

function getExpectedProviderMessage(): string {
  return `Expected one of: ${BUILT_IN_PROVIDERS.join(", ")}.`;
}

/**
 * Serialize a {@link ModelSelection} to the canonical `"provider/model"` string
 * used for storage. Built-in providers are lower-cased; custom providers use
 * their server-side id as the prefix.
 */
export function formatModelSelection(selection: ModelSelection): string {
  if (selection.providerType === "builtin") {
    return `${selection.provider.toLowerCase()}/${selection.modelName}`;
  }
  return `${selection.providerId}/${selection.modelName}`;
}

/**
 * Parse a `"provider/model"` string back into the raw option pair consumed by
 * {@link resolveModelSelection}. Returns `undefined` for `provider` when the
 * string contains no slash (treated as a bare model name only).
 */
export function parseModelString(s: string): {
  provider: string | undefined;
  model: string;
} {
  const slashIdx = s.indexOf("/");
  if (slashIdx === -1) {
    return { provider: undefined, model: s };
  }
  return { provider: s.slice(0, slashIdx), model: s.slice(slashIdx + 1) };
}

function isBuiltInProvider(provider: string): provider is BuiltInProvider {
  return BUILT_IN_PROVIDERS.includes(provider as BuiltInProvider);
}

function normalizeBuiltInProvider({ provider }: { provider: string }): string {
  return provider.toUpperCase();
}

/**
 * Turn the raw `--provider` / `--model` / `--custom-provider-id` flags into a
 * normalized {@link ModelSelection}.
 *
 * Passing `--custom-provider-id` selects a custom provider and requires an
 * explicit `--model`. Otherwise a built-in provider is used: its name is
 * upper-cased and validated against {@link BUILT_IN_PROVIDERS}, and the model
 * falls back to {@link DEFAULT_PXI_MODEL}. Throws {@link InvalidArgumentError}
 * for an unknown provider or a custom provider missing its model.
 */
export function resolveModelSelection({
  provider,
  model,
  customProviderId,
}: {
  provider?: string;
  model?: string;
  customProviderId?: string;
}): ModelSelection {
  const trimmedModel = model?.trim();
  const trimmedCustomProviderId = customProviderId?.trim();

  // Support "provider/model" combined format in the --model flag value.
  // When the model string contains a slash and no custom provider is set,
  // split it and recurse so all the normal validation still applies.
  if (trimmedModel?.includes("/") && !trimmedCustomProviderId) {
    const { provider: embeddedProvider, model: embeddedModel } =
      parseModelString(trimmedModel);
    return resolveModelSelection({
      provider: embeddedProvider ?? provider,
      model: embeddedModel,
      customProviderId,
    });
  }

  if (trimmedCustomProviderId) {
    if (!trimmedModel) {
      throw new InvalidArgumentError(
        "Missing required flag --model when --custom-provider-id is provided. Expected a non-empty model name."
      );
    }
    return {
      providerType: "custom",
      providerId: trimmedCustomProviderId,
      modelName: trimmedModel,
    };
  }

  const rawSelectedProvider = (provider ?? DEFAULT_PXI_PROVIDER).trim();
  const selectedProvider = normalizeBuiltInProvider({
    provider: rawSelectedProvider,
  });
  if (!isBuiltInProvider(selectedProvider)) {
    throw new InvalidArgumentError(
      `Invalid value for --provider: ${rawSelectedProvider}. ${getExpectedProviderMessage()}`
    );
  }

  return {
    providerType: "builtin",
    provider: selectedProvider,
    modelName: trimmedModel || DEFAULT_PXI_MODEL,
  };
}

/**
 * Build the fully-resolved {@link PxiRuntimeOptions} for a session from parsed
 * CLI flags. This layers the endpoint/api-key/profile through
 * {@link resolveConfig}, resolves the model selection, and coerces the boolean
 * feature flags into their final shape. A fresh `sessionId` is generated unless
 * one is supplied (tests pass a fixed id for determinism).
 */
export function resolvePxiRuntimeOptions({
  cliOptions,
  sessionId = crypto.randomUUID(),
}: ResolvePxiRuntimeOptionsInput): PxiRuntimeOptions {
  const config = resolveConfig({
    cliOptions: {
      endpoint: cliOptions.endpoint,
      apiKey: cliOptions.apiKey,
    },
    profileName: cliOptions.profile,
  });
  const modelSelection = resolveModelSelection({
    provider: cliOptions.provider,
    model: cliOptions.model,
    customProviderId: cliOptions.customProviderId,
  });
  const editPermission: PxiEditPermission = cliOptions.bypassEdits
    ? "bypass"
    : "manual";

  return {
    sessionId,
    config,
    modelSelection,
    skipModelPreflight: Boolean(cliOptions.skipModelPreflight),
    enableWebAccess: Boolean(cliOptions.enableWebAccess),
    enableSubagents: Boolean(cliOptions.enableSubagents),
    enableGraphqlMutations: Boolean(cliOptions.enableGraphqlMutations),
    editPermission,
    ingestTraces: Boolean(cliOptions.ingestTraces),
    exportRemoteTraces: Boolean(cliOptions.exportRemoteTraces),
    attachUserId: Boolean(cliOptions.attachUserId),
  };
}

/**
 * Define the `pxi` Commander program: its flags, defaults, and help text.
 * Kept separate from parsing so tests can introspect the command definition
 * without executing it.
 */
export function createPxiProgram(): Command {
  const program = new Command();

  program
    .name("pxi")
    .description("Open an interactive Phoenix PXI terminal chat.")
    .option("--endpoint <url>", "Phoenix endpoint URL")
    .option("--api-key <key>", "Phoenix API key")
    .option("--profile <name>", "Phoenix CLI profile name")
    .option(
      "--provider <provider>",
      `Built-in model provider (${BUILT_IN_PROVIDERS.join("|")})`,
      DEFAULT_PXI_PROVIDER
    )
    .option(
      "--model <model>",
      `Model name (defaults to ${DEFAULT_PXI_MODEL} for built-in providers)`
    )
    .option("--custom-provider-id <id>", "Custom provider ID")
    .option(
      "--skip-model-preflight",
      "Skip Phoenix model catalog and credential checks before launch"
    )
    .option("--enable-web-access", "Enable PXI web access context")
    .option("--enable-subagents", "Enable PXI subagent context")
    .option(
      "--enable-graphql-mutations",
      "Allow server-agent GraphQL mutation tools"
    )
    .option("--bypass-edits", "Bypass manual edit approvals when supported")
    .option("--ingest-traces", "Persist local PXI traces in Phoenix")
    .option("--export-remote-traces", "Export PXI traces remotely")
    .option(
      "--attach-user-id",
      "Attach the authenticated Phoenix user to PXI traces"
    )
    .addHelpText(
      "after",
      `
Examples:
  pxi
  pxi --endpoint http://localhost:6006 --provider OPENAI --model gpt-5.4
  pxi --custom-provider-id provider-id --model custom-agent-model
`
    );

  return program;
}

/**
 * Parse `argv` with the `pxi` program and resolve it into runtime options. This
 * is the one-call path used by the entry point; `createPxiProgram` and
 * `resolvePxiRuntimeOptions` are exposed separately for finer-grained testing.
 */
export async function parsePxiRuntimeOptions({
  argv = process.argv,
  settingsPath,
}: {
  argv?: string[];
  settingsPath?: string;
} = {}): Promise<PxiRuntimeOptions> {
  const program = createPxiProgram();
  await program.parseAsync(argv);
  const rawOpts = program.opts<RawPxiOptions>();

  const providerExplicit = program.getOptionValueSource("provider") === "cli";
  const modelExplicit = program.getOptionValueSource("model") === "cli";
  const userSetModel = providerExplicit || modelExplicit;

  if (!userSetModel) {
    // Restore the last-used model from settings when no explicit flags were passed.
    const settings = loadSettings({ settingsPath });
    const storedModel = settings.pxi?.model;
    if (storedModel) {
      const parsed = parseModelString(storedModel);
      rawOpts.provider = parsed.provider;
      rawOpts.model = parsed.model;
    }
  }

  const options = resolvePxiRuntimeOptions({ cliOptions: rawOpts });

  if (userSetModel) {
    // Persist the newly-chosen model so the next `pxi` launch restores it.
    const settings = loadSettings({ settingsPath });
    const modelStr = formatModelSelection(options.modelSelection);
    saveSettings(
      { ...settings, pxi: { ...settings.pxi, model: modelStr } },
      { settingsPath }
    );
  }

  return options;
}
