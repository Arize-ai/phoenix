import {
  AGENT_SESSION_CHAT,
  AGENT_SESSION_COMPACT,
  AGENT_SESSION_CREATE,
  AGENT_SESSION_GET,
  AGENT_SESSION_LIST,
  AGENT_SESSION_MESSAGES,
  AGENT_SESSION_PATCH,
  ensureServerCapability,
  type CapabilityRequirement,
} from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../client";
import { buildGraphqlRequest } from "../commands/api";
import type { PhoenixConfig } from "../config";
import { InvalidArgumentError } from "../exitCodes";
import type {
  BuiltInProvider,
  ModelSelection,
  PxiRuntimeOptions,
} from "./types";

/**
 * Pre-launch validation of the selected model.
 *
 * Before the chat UI opens, PXI asks the Phoenix server which providers and
 * models are actually installed and credentialed, then checks the user's
 * `--provider`/`--model` selection against that catalog. Catching a bad or
 * unconfigured model here turns what would be a cryptic mid-stream failure into
 * a clear, actionable startup error. The whole check can be skipped with
 * `--skip-model-preflight`.
 */

/** GraphQL query fetching the server's provider catalog, credential state, and known models. */
export const PXI_MODEL_PREFLIGHT_QUERY = /* GraphQL */ `
  query PxiModelPreflightQuery {
    modelProviders {
      key
      name
      dependenciesInstalled
      credentialsSet
      credentialRequirements {
        envVarName
        isRequired
      }
    }
    playgroundModels {
      providerKey
      name
    }
    generativeModelCustomProviders(first: 50) {
      edges {
        node {
          id
          name
          sdk
          modelNames
        }
      }
    }
  }
`;

type PxiModelProvider = {
  key: string;
  name: string;
  dependenciesInstalled: boolean;
  credentialsSet: boolean;
  credentialRequirements: Array<{
    envVarName: string;
    isRequired: boolean;
  }>;
};

type PxiPlaygroundModel = {
  providerKey: string;
  name: string;
};

type PxiCustomProvider = {
  id: string;
  name: string;
  sdk: string;
  modelNames: string[];
};

export type PxiModelPreflightData = {
  modelProviders: PxiModelProvider[];
  playgroundModels: PxiPlaygroundModel[];
  generativeModelCustomProviders: {
    edges: Array<{
      node: PxiCustomProvider;
    }>;
  };
};

const RECOMMENDED_PXI_MODELS = [
  { provider: "ANTHROPIC", modelName: "claude-fable-5" },
  { provider: "ANTHROPIC", modelName: "claude-opus-4-8" },
  { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
  { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
  { provider: "OPENAI", modelName: "gpt-5.6-sol" },
  { provider: "OPENAI", modelName: "gpt-5.4" },
  { provider: "OPENAI", modelName: "gpt-5.4-mini" },
  { provider: "OPENAI", modelName: "gpt-5.5" },
  { provider: "GOOGLE", modelName: "gemini-3.1-pro-preview" },
  { provider: "GOOGLE", modelName: "gemini-3.5-flash" },
] as const satisfies readonly {
  provider: BuiltInProvider;
  modelName: string;
}[];

type GraphqlError = {
  message?: string;
};

type GraphqlResponse<Data> = {
  data?: Data;
  errors?: GraphqlError[];
};

/**
 * Render a list of values for an error message, capping it at `limit` and
 * summarizing the overflow as "…, and N more" so messages stay readable when a
 * provider exposes many models.
 */
function formatList({
  values,
  limit = 8,
}: {
  values: string[];
  limit?: number;
}): string {
  if (values.length === 0) {
    return "none";
  }
  const visibleValues = values.slice(0, limit);
  const remainingCount = values.length - visibleValues.length;
  if (remainingCount <= 0) {
    return visibleValues.join(", ");
  }
  return `${visibleValues.join(", ")}, and ${remainingCount} more`;
}

function getModelLabel({
  modelSelection,
}: {
  modelSelection: ModelSelection;
}): string {
  if (modelSelection.providerType === "custom") {
    return `custom:${modelSelection.providerId}/${modelSelection.modelName}`;
  }
  return `${modelSelection.provider}/${modelSelection.modelName}`;
}

function getErrorMessage({ error }: { error: unknown }): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCauseMessage({ error }: { error: unknown }): string | null {
  if (!(error instanceof Error) || !("cause" in error)) {
    return null;
  }
  const cause = error.cause;
  if (!cause) {
    return null;
  }
  return getErrorMessage({ error: cause });
}

function formatEndpointPreflightFailure({
  error,
  endpoint,
  requestUrl,
}: {
  error: unknown;
  endpoint: string;
  requestUrl: string;
}): string {
  const causeMessage = getErrorCauseMessage({ error });
  const causeLine = causeMessage ? `\nCause: ${causeMessage}` : "";
  return [
    "Could not reach Phoenix during PXI startup preflight.",
    "",
    `Endpoint: ${endpoint}`,
    `Request: ${requestUrl}`,
    `Network error: ${getErrorMessage({ error })}${causeLine}`,
    "",
    "How to fix:",
    "  1. Start Phoenix and confirm the server is listening.",
    "  2. If Phoenix is running at a different URL, pass --endpoint <url> or set PHOENIX_ENDPOINT.",
    "  3. For remote endpoints, check VPN, proxy, firewall, and DNS settings.",
    "  4. To skip only model validation, pass --skip-model-preflight.",
  ].join("\n");
}

/**
 * Compose the "missing credentials" error for a provider, listing the required
 * environment variables (falling back to all known ones if none are flagged
 * required) and clarifying that these are server-side provider credentials, not
 * the PXI CLI `--api-key`.
 */
function buildServerCredentialMessage({
  provider,
}: {
  provider: PxiModelProvider;
}): string {
  const requiredEnvVars = provider.credentialRequirements
    .filter((requirement) => requirement.isRequired)
    .map((requirement) => requirement.envVarName);
  const envVars =
    requiredEnvVars.length > 0
      ? requiredEnvVars
      : provider.credentialRequirements.map(
          (requirement) => requirement.envVarName
        );
  return [
    `Missing credentials for ${provider.name} (${provider.key}).`,
    `Required server credential variables/secrets: ${formatList({
      values: envVars,
    })}.`,
    "Configure credentials in Phoenix Settings > AI Providers, or set the required environment variables on the Phoenix server.",
    "These are Phoenix server-side provider credentials, not the PXI CLI --api-key.",
  ].join(" ");
}

function getCustomProviders({
  data,
}: {
  data: PxiModelPreflightData;
}): PxiCustomProvider[] {
  return data.generativeModelCustomProviders.edges.map((edge) => edge.node);
}

async function readResponseText({
  response,
}: {
  response: Response;
}): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Unwrap a GraphQL response into its `data`, throwing a descriptive error if the
 * server returned GraphQL errors or no data at all. Error messages point at
 * `--skip-model-preflight` as the escape hatch.
 */
function assertPreflightData({
  payload,
}: {
  payload: GraphqlResponse<PxiModelPreflightData>;
}): PxiModelPreflightData {
  const errors = payload.errors
    ?.map((error) => error.message)
    .filter((message): message is string => Boolean(message));
  if (errors && errors.length > 0) {
    throw new Error(
      `Could not validate PXI model selection because Phoenix returned GraphQL errors: ${errors.join(
        "; "
      )}. Use --skip-model-preflight to bypass this startup check.`
    );
  }
  if (!payload.data) {
    throw new Error(
      "Could not validate PXI model selection because Phoenix returned no GraphQL data. Use --skip-model-preflight to bypass this startup check."
    );
  }
  return payload.data;
}

/**
 * Fetch the provider/model catalog from Phoenix via GraphQL. Requires a
 * configured endpoint and turns non-2xx responses into errors that include the
 * HTTP status and any response body. `fetchImpl` is injectable for testing.
 */
export async function fetchPxiModelPreflight({
  config,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PxiModelPreflightData> {
  if (!config.endpoint) {
    throw new InvalidArgumentError(
      "Phoenix endpoint not configured. Set PHOENIX_ENDPOINT or pass --endpoint."
    );
  }
  const request = buildGraphqlRequest({
    query: PXI_MODEL_PREFLIGHT_QUERY,
    config,
  });
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  } catch (error) {
    throw new TypeError(
      formatEndpointPreflightFailure({
        error,
        endpoint: config.endpoint,
        requestUrl: request.url,
      }),
      { cause: error }
    );
  }
  if (!response.ok) {
    const detail = await readResponseText({ response });
    const detailText = detail ? `: ${detail}` : "";
    throw new Error(
      `Could not validate PXI model selection: HTTP ${response.status} ${response.statusText} from ${request.url}${detailText}. Use --skip-model-preflight to bypass this startup check.`
    );
  }
  const payload =
    (await response.json()) as GraphqlResponse<PxiModelPreflightData>;
  return assertPreflightData({ payload });
}

/** Return the main app's recommended models that exist in this server's catalog. */
export function getRecommendedPxiModels({
  data,
}: {
  data: PxiModelPreflightData;
}): ModelSelection[] {
  return RECOMMENDED_PXI_MODELS.filter(({ provider, modelName }) =>
    data.playgroundModels.some(
      (model) => model.providerKey === provider && model.name === modelName
    )
  ).map(({ provider, modelName }) => ({
    providerType: "builtin",
    provider,
    modelName,
  }));
}

/** Fetch the recommended model choices displayed by the interactive picker. */
export async function fetchRecommendedPxiModels({
  config,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<ModelSelection[]> {
  const data = await fetchPxiModelPreflight({ config, fetchImpl });
  return getRecommendedPxiModels({ data });
}

/**
 * Check a model selection against the fetched catalog, throwing
 * {@link InvalidArgumentError} with a helpful message on the first problem.
 *
 * For custom providers: the provider id must exist, and the model must be one of
 * its configured names (when it advertises any). For built-in providers: the
 * provider must be available, have its dependencies installed and credentials
 * set, and — if the server publishes a model catalog for it — the model must be
 * in that catalog. A provider with no published catalog accepts any model name.
 */
export function validatePxiModelSelection({
  data,
  modelSelection,
}: {
  data: PxiModelPreflightData;
  modelSelection: ModelSelection;
}): void {
  if (modelSelection.providerType === "custom") {
    const customProviders = getCustomProviders({ data });
    const provider = customProviders.find(
      (candidate) => candidate.id === modelSelection.providerId
    );
    if (!provider) {
      throw new InvalidArgumentError(
        `Custom provider ${modelSelection.providerId} was not found on this Phoenix server. Configure it in Phoenix Settings > AI Providers or pass --skip-model-preflight. Available custom provider IDs: ${formatList(
          { values: customProviders.map((candidate) => candidate.id) }
        )}.`
      );
    }
    if (
      provider.modelNames.length > 0 &&
      !provider.modelNames.includes(modelSelection.modelName)
    ) {
      throw new InvalidArgumentError(
        `Invalid model for custom provider ${provider.name} (${provider.id}): ${modelSelection.modelName}. Configured model names: ${formatList(
          { values: provider.modelNames }
        )}.`
      );
    }
    return;
  }

  const provider = data.modelProviders.find(
    (candidate) => candidate.key === modelSelection.provider
  );
  const availableProviderKeys = data.modelProviders.map(
    (candidate) => candidate.key
  );
  if (!provider) {
    throw new InvalidArgumentError(
      `Provider ${modelSelection.provider} is not available on this Phoenix server. Available providers: ${formatList(
        { values: availableProviderKeys }
      )}.`
    );
  }
  if (!provider.dependenciesInstalled) {
    throw new InvalidArgumentError(
      `${provider.name} (${provider.key}) is unavailable because the Phoenix server does not have that provider installed. Install the provider dependencies on the Phoenix server or choose another provider.`
    );
  }
  if (provider.credentialRequirements.length > 0 && !provider.credentialsSet) {
    throw new InvalidArgumentError(buildServerCredentialMessage({ provider }));
  }

  const providerModels = data.playgroundModels
    .filter((model) => model.providerKey === modelSelection.provider)
    .map((model) => model.name);
  const hasProviderCatalog = providerModels.length > 0;
  const isKnownModel = providerModels.includes(modelSelection.modelName);
  if (hasProviderCatalog && !isKnownModel) {
    throw new InvalidArgumentError(
      `Invalid model for ${provider.name} (${provider.key}): ${modelSelection.modelName}. Available models for this provider include: ${formatList(
        { values: providerModels }
      )}.`
    );
  }
}

/**
 * Run the full preflight for a session: fetch the catalog and validate the
 * given model selection, unless `--skip-model-preflight` was passed. This is
 * the single call the entry point makes before rendering the UI, and the
 * restored-session path reuses it so any future preflight step (e.g. catalog
 * caching) covers both.
 * @param params.options - the resolved PXI runtime options
 * @param params.modelSelection - the selection to validate; defaults to the
 * CLI launch selection
 */
export async function runPxiModelPreflight({
  options,
  modelSelection = options.modelSelection,
  fetchImpl = globalThis.fetch,
}: {
  options: PxiRuntimeOptions;
  modelSelection?: ModelSelection;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<void> {
  if (options.skipModelPreflight) {
    return;
  }
  const data = await fetchPxiModelPreflight({
    config: options.config,
    fetchImpl,
  });
  validatePxiModelSelection({
    data,
    modelSelection,
  });
}

/** Agent-session capabilities every PXI run depends on. */
const PXI_SERVER_CAPABILITIES: readonly CapabilityRequirement[] = [
  AGENT_SESSION_CREATE,
  AGENT_SESSION_LIST,
  AGENT_SESSION_GET,
  AGENT_SESSION_PATCH,
  AGENT_SESSION_MESSAGES,
  AGENT_SESSION_COMPACT,
  AGENT_SESSION_CHAT,
];

export async function runPxiServerVersionPreflight({
  options,
  fetchImpl,
}: {
  options: PxiRuntimeOptions;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<void> {
  const client = createPhoenixClient({
    config: options.config,
    fetch: fetchImpl,
  });
  for (const requirement of PXI_SERVER_CAPABILITIES) {
    await ensureServerCapability({ client, requirement });
  }
}

/** Whether two selections name the same provider and model. */
export function isSameModelSelection(
  a: ModelSelection,
  b: ModelSelection
): boolean {
  if (a.providerType === "custom" || b.providerType === "custom") {
    return (
      a.providerType === "custom" &&
      b.providerType === "custom" &&
      a.providerId === b.providerId &&
      a.modelName === b.modelName
    );
  }
  return a.provider === b.provider && a.modelName === b.modelName;
}

/**
 * Resolve the model a restored session should display: always its persisted
 * selection. The server-side record is the source of truth — every send
 * asserts the displayed model, so displaying anything else (a fallback, the
 * CLI default) would make the server reject each send with
 * `agent_session_model_stale`. When the catalog says the persisted selection
 * is invalid, `onInvalidModel` is called so the UI can warn the user; a
 * transient catalog fetch failure is ignored entirely and the persisted
 * selection is kept unvalidated.
 *
 * Explicit `--provider`/`--model` flags are deliberately *not* honoured here.
 * They express an intent to move the session, which is applied once — as a
 * write — when the session is restored; re-applying them on every poll would
 * mask model changes made by other clients.
 * @param params.onInvalidModel - called when the persisted selection fails
 * catalog validation (not on catalog fetch failures)
 */
export async function resolveRestoredPxiModelSelection({
  options,
  persistedModelSelection,
  onInvalidModel,
  fetchImpl = globalThis.fetch,
}: {
  options: PxiRuntimeOptions;
  persistedModelSelection: ModelSelection;
  onInvalidModel?: (params: { error: InvalidArgumentError }) => void;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<ModelSelection> {
  try {
    await runPxiModelPreflight({
      options,
      modelSelection: persistedModelSelection,
      fetchImpl,
    });
  } catch (error) {
    // Validation failures name a model the catalog rejects; anything else is
    // a transient fetch failure and the next resolve re-validates.
    if (error instanceof InvalidArgumentError) {
      onInvalidModel?.({ error });
    }
  }
  return persistedModelSelection;
}

/**
 * Wrap an error thrown while talking to PXI into a single message that names the
 * model and appends a tailored next step — pointing custom providers at their
 * Phoenix settings and built-in providers at credential configuration or
 * choosing a different model. Used for failures that surface after the preflight
 * has already passed.
 */
export function formatPxiRuntimeError({
  error,
  modelSelection,
}: {
  error: unknown;
  modelSelection: ModelSelection;
}): Error {
  const message = error instanceof Error ? error.message : String(error);
  const nextAction =
    modelSelection.providerType === "custom"
      ? "Check the custom provider configuration in Phoenix Settings > AI Providers."
      : `Configure ${modelSelection.provider} credentials in Phoenix Settings > AI Providers, set the required environment variables on the Phoenix server, or choose a different model.`;
  return new Error(
    `PXI request failed for ${getModelLabel({ modelSelection })}: ${message} ${nextAction}`
  );
}
