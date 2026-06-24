import { Command } from "commander";

import { resolveConfig } from "../config";
import { InvalidArgumentError } from "../exitCodes";
import type {
  BuiltInProvider,
  ModelSelection,
  PxiEditPermission,
  PxiRuntimeOptions,
} from "./types";

export const DEFAULT_PXI_PROVIDER: BuiltInProvider = "ANTHROPIC";
export const DEFAULT_PXI_MODEL = "claude-opus-4-6";

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

function isBuiltInProvider(provider: string): provider is BuiltInProvider {
  return BUILT_IN_PROVIDERS.includes(provider as BuiltInProvider);
}

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

  const selectedProvider = (provider ?? DEFAULT_PXI_PROVIDER).trim();
  if (!isBuiltInProvider(selectedProvider)) {
    throw new InvalidArgumentError(
      `Invalid value for --provider: ${selectedProvider}. ${getExpectedProviderMessage()}`
    );
  }

  return {
    providerType: "builtin",
    provider: selectedProvider,
    modelName: trimmedModel || DEFAULT_PXI_MODEL,
  };
}

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
    enableWebAccess: Boolean(cliOptions.enableWebAccess),
    enableSubagents: Boolean(cliOptions.enableSubagents),
    enableGraphqlMutations: Boolean(cliOptions.enableGraphqlMutations),
    editPermission,
    ingestTraces: Boolean(cliOptions.ingestTraces),
    exportRemoteTraces: Boolean(cliOptions.exportRemoteTraces),
    attachUserId: Boolean(cliOptions.attachUserId),
  };
}

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

export async function parsePxiRuntimeOptions({
  argv = process.argv,
}: {
  argv?: string[];
} = {}): Promise<PxiRuntimeOptions> {
  const program = createPxiProgram();
  await program.parseAsync(argv);
  return resolvePxiRuntimeOptions({
    cliOptions: program.opts<RawPxiOptions>(),
  });
}
