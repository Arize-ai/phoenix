import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import type { FetchPolicy } from "relay-runtime";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";

import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
  useModelMenuDataQuery,
} from "./__generated__/useModelMenuDataQuery.graphql";
import {
  getProviderKeyForGenerativeModelSDK,
  isProviderProvisioned,
  isProviderReady,
  type LocalProviderCredentials,
  providerNeedsCredentials,
} from "./modelProviderUtils";

export type { GenerativeModelSDK, GenerativeProviderKey };

export type CustomProviderInfo = {
  id: string;
  name: string;
  sdk: GenerativeModelSDK;
  modelNames: readonly string[];
};

export type AvailableBuiltinModel = {
  provider: ModelProvider;
  modelName: string;
};

export type AvailableCustomModel = {
  customProviderId: string;
  customProviderName: string;
  provider: ModelProvider;
  modelName: string;
};

export type ModelCatalog = {
  installedBuiltInProviders: ReadonlySet<ModelProvider>;
  customProviders: readonly CustomProviderInfo[];
};

export type ModelProviderInfo = {
  readonly key: GenerativeProviderKey;
  readonly name: string;
  readonly dependenciesInstalled: boolean;
  readonly credentialsSet: boolean;
  /**
   * The model types the provider offers, as the server derives them from its
   * registered clients: chat (LLM), decision, or both.
   */
  readonly modelTypes: readonly ModelType[];
  /**
   * True when the provider requires credentials and none are explicitly set
   * on the server or in the browser. Drives the "Needs credentials" hint.
   */
  readonly needsCredentials?: boolean;
};

/**
 * Flagship providers surfaced in the picker when no provider has been
 * provisioned, in display order.
 */
const FALLBACK_PROVIDER_KEYS: readonly GenerativeProviderKey[] = [
  "OPENAI",
  "ANTHROPIC",
  "AZURE_OPENAI",
  "AWS",
  "GOOGLE",
];

type CatalogModel = {
  readonly name: string;
  readonly providerKey: string;
};

// Stable empty catalog so an omitted decision list does not invalidate the
// memoized grouping on every render.
const NO_CATALOG_MODELS: readonly CatalogModel[] = [];

export function getModelsByProvider(
  playgroundModels: readonly CatalogModel[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const model of playgroundModels) {
    const existing = grouped.get(model.providerKey) ?? [];
    existing.push(model.name);
    grouped.set(model.providerKey, existing);
  }
  return grouped;
}

/**
 * Where a surface's model executions resolve credentials from. Playground
 * passes browser-local credentials with its requests, so local keys make a
 * provider genuinely usable there ("any"). Surfaces that send through the
 * server's `/v1/chat/completions` proxy authenticate exclusively with
 * server-side credentials ("server") — browser-local keys must not make a
 * provider look ready or count as provisioned, or the menu offers models the
 * execution path cannot authenticate.
 */
export type ModelCredentialSource = "any" | "server";

// Stable empty store so the "server" credential source doesn't invalidate
// the memoized readiness computations on every render.
const NO_LOCAL_CREDENTIALS: LocalProviderCredentials = {};

/**
 * Loads the model catalog (built-in providers, custom providers, playground
 * models) shared by the model pickers and the agent session model readers.
 *
 * @param params - hook options
 * @param params.fetchPolicy - Relay fetch policy for the catalog query.
 *   Defaults to "store-and-network" so pickers stay fresh; consumers that
 *   mount alongside a picker on the same surface can pass "store-or-network"
 *   to reuse its response instead of issuing a duplicate network fetch.
 * @param params.credentialSource - which credential store the surface's
 *   execution path can actually use; see {@link ModelCredentialSource}.
 * @param params.modelType - which catalog `modelsByProvider` and
 *   `visibleProviders` describe. Defaults to chat (LLM) models.
 * @param params.includeDecisionModels - also fetch the decision catalog.
 *   Only surfaces with a decision execution path need it; the flag is a
 *   query variable, so toggling `modelType` never refetches.
 */
export function useModelMenuData({
  fetchPolicy = "store-and-network",
  credentialSource = "any",
  modelType = "LLM",
  includeDecisionModels = false,
}: {
  fetchPolicy?: FetchPolicy;
  credentialSource?: ModelCredentialSource;
  modelType?: ModelType;
  includeDecisionModels?: boolean;
} = {}) {
  const data = useLazyLoadQuery<useModelMenuDataQuery>(
    graphql`
      query useModelMenuDataQuery($includeDecisionModels: Boolean!) {
        generativeModelCustomProviders {
          edges {
            node {
              id
              name
              sdk
              modelNames
            }
          }
        }
        modelProviders {
          key
          name
          dependenciesInstalled
          credentialsSet
          modelTypes
        }
        playgroundModels {
          name
          providerKey
          modelType
        }
        decisionModels: playgroundModels(
          input: { providerKey: null, modelType: DECISION }
        ) @include(if: $includeDecisionModels) {
          name
          providerKey
          modelType
        }
      }
    `,
    { includeDecisionModels },
    { fetchPolicy }
  );

  const decisionModels = data.decisionModels ?? NO_CATALOG_MODELS;
  const catalogModels =
    modelType === "DECISION" ? decisionModels : data.playgroundModels;
  const modelsByProvider = useMemo(
    () => getModelsByProvider(catalogModels),
    [catalogModels]
  );

  const providerInfoMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; dependenciesInstalled: boolean }
    >();
    for (const provider of data.modelProviders) {
      map.set(provider.key, {
        name: provider.name,
        dependenciesInstalled: provider.dependenciesInstalled,
      });
    }
    return map;
  }, [data.modelProviders]);

  const customProviders = useMemo((): CustomProviderInfo[] => {
    return data.generativeModelCustomProviders.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      sdk: edge.node.sdk,
      modelNames: edge.node.modelNames,
    }));
  }, [data.generativeModelCustomProviders]);

  const installedBuiltInProviders = useMemo(
    () =>
      new Set(
        data.modelProviders
          .filter((provider) => provider.dependenciesInstalled)
          .map((provider) => provider.key as ModelProvider)
      ),
    [data.modelProviders]
  );

  const availableBuiltinModels = useMemo<AvailableBuiltinModel[]>(
    () =>
      data.playgroundModels
        .filter((model) =>
          installedBuiltInProviders.has(model.providerKey as ModelProvider)
        )
        .map((model) => ({
          provider: model.providerKey as ModelProvider,
          modelName: model.name,
        })),
    [data.playgroundModels, installedBuiltInProviders]
  );

  const availableCustomModels = useMemo<AvailableCustomModel[]>(
    () =>
      customProviders.flatMap((provider) => {
        const providerKey = getProviderKeyForGenerativeModelSDK(provider.sdk);
        return provider.modelNames.map((modelName) => ({
          customProviderId: provider.id,
          customProviderName: provider.name,
          provider: providerKey,
          modelName,
        }));
      }),
    [customProviders]
  );

  const modelCatalog = useMemo<ModelCatalog>(
    () => ({
      installedBuiltInProviders,
      customProviders,
    }),
    [customProviders, installedBuiltInProviders]
  );

  const storedLocalCredentials: LocalProviderCredentials =
    useCredentialsContext((state) => state);
  // Server-proxied surfaces cannot authenticate with browser-local keys, so
  // readiness/provisioned/needs-credentials all compute as if none exist.
  const localCredentials: LocalProviderCredentials =
    credentialSource === "server"
      ? NO_LOCAL_CREDENTIALS
      : storedLocalCredentials;

  // Every provider annotated with whether it still needs credentials, so
  // menu items can hint at unconfigured providers.
  const providersWithStatus = useMemo<ModelProviderInfo[]>(
    () =>
      data.modelProviders.map((provider) => ({
        ...provider,
        needsCredentials: providerNeedsCredentials({
          provider,
          localCredentials,
        }),
      })),
    [data.modelProviders, localCredentials]
  );

  // Providers that are usable right now: dependencies installed and
  // credentials satisfied on the server or in the browser.
  const readyProviders = useMemo<ModelProviderInfo[]>(
    () =>
      providersWithStatus.filter((provider) =>
        isProviderReady({ provider, localCredentials })
      ),
    [providersWithStatus, localCredentials]
  );

  // Whether the user has explicitly set up any chat provider — credentials
  // for a built-in provider with chat models, or a custom provider.
  // Zero-credential providers (e.g. Ollama) are always ready but do not
  // count as provisioned, and configuring only a decision-only provider must
  // not change which chat providers the picker shows.
  const hasProvisionedProvider = useMemo(
    () =>
      customProviders.length > 0 ||
      data.modelProviders.some(
        (provider) =>
          provider.modelTypes.includes("LLM") &&
          isProviderProvisioned({ provider, localCredentials })
      ),
    [customProviders, data.modelProviders, localCredentials]
  );

  // Providers to list in the picker for the selected model type. For chat,
  // once the user has provisioned a provider only ready chat providers are
  // shown; before that, fall back to the flagship providers so the picker is
  // not empty. Fallback providers with missing server dependencies render
  // disabled.
  const visibleProviders = useMemo<ModelProviderInfo[]>(() => {
    if (modelType === "DECISION") {
      // Decision clients speak plain HTTP, so a provider whose chat SDK is
      // missing can still run decisions; the server reports installation per
      // provider, not per model type.
      return providersWithStatus
        .filter((provider) => provider.modelTypes.includes("DECISION"))
        .map((provider) => ({ ...provider, dependenciesInstalled: true }));
    }
    if (hasProvisionedProvider) {
      return readyProviders.filter((provider) =>
        provider.modelTypes.includes("LLM")
      );
    }
    const providersByKey = new Map(
      providersWithStatus.map((provider) => [provider.key, provider])
    );
    return FALLBACK_PROVIDER_KEYS.flatMap(
      (key) => providersByKey.get(key) ?? []
    );
  }, [hasProvisionedProvider, readyProviders, providersWithStatus, modelType]);

  return {
    availableBuiltinModels,
    availableCustomModels,
    customProviders,
    data,
    modelCatalog,
    modelsByProvider,
    providerInfoMap,
    visibleProviders,
  };
}
