import { buildGraphqlRequest } from "../commands/api";
import type { PhoenixConfig } from "../config";
import { InvalidArgumentError } from "../exitCodes";
import type { ModelSelection, PxiRuntimeOptions } from "./types";

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
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
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
