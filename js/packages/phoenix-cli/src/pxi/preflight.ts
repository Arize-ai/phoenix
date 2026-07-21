import {
  AGENT_ASSISTANT_SESSION_CHAT,
  satisfiesMinVersion,
} from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../client";
import { buildGraphqlRequest } from "../commands/api";
import type { PhoenixConfig } from "../config";
import { InvalidArgumentError } from "../exitCodes";
import type {
  ModelSelection,
  PxiRuntimeOptions,
  PxiTransportMode,
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

type PxiModelPreflightData = {
  modelProviders: PxiModelProvider[];
  playgroundModels: PxiPlaygroundModel[];
  generativeModelCustomProviders: {
    edges: Array<{
      node: PxiCustomProvider;
    }>;
  };
};

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
    "  2. If Phoenix is running at a different URL, pass --endpoint <url> or set PHOENIX_HOST.",
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
      "Phoenix endpoint not configured. Set PHOENIX_HOST or pass --endpoint."
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
 * selected model, unless `--skip-model-preflight` was passed. This is the single
 * call the entry point makes before rendering the UI.
 */
export async function runPxiModelPreflight({
  options,
  fetchImpl = globalThis.fetch,
}: {
  options: PxiRuntimeOptions;
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
    modelSelection: options.modelSelection,
  });
}

/**
 * Decide which chat wire contract to use for this session by checking the
 * connected server's version against the agent-session chat requirement.
 *
 * Servers at or above the requirement get `"agent-session"` (server-side
 * sessions, single-message turns). Older servers — including ones whose
 * version cannot be determined at all — get `"legacy-server-agent"`, the
 * stateless full-transcript route they still expose, so a new CLI keeps
 * working against old self-hosted deployments. `fetchImpl` is injectable for
 * testing.
 */
export async function resolvePxiTransportMode({
  config,
  fetchImpl,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PxiTransportMode> {
  const client = createPhoenixClient({ config, fetch: fetchImpl });
  try {
    const version = await client.getServerVersion();
    return satisfiesMinVersion({
      version,
      minVersion: AGENT_ASSISTANT_SESSION_CHAT.minServerVersion,
    })
      ? "agent-session"
      : "legacy-server-agent";
  } catch {
    return "legacy-server-agent";
  }
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
