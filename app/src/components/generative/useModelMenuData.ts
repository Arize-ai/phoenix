import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";

import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
  useModelMenuDataQuery,
} from "./__generated__/useModelMenuDataQuery.graphql";

export type { GenerativeModelSDK, GenerativeProviderKey };
import {
  getProviderKeyForGenerativeModelSDK,
  isProviderProvisioned,
  isProviderReady,
  type LocalProviderCredentials,
} from "./modelProviderUtils";

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
};

export function getModelsByProvider(
  playgroundModels: readonly {
    readonly name: string;
    readonly providerKey: string;
  }[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const model of playgroundModels) {
    const existing = grouped.get(model.providerKey) ?? [];
    existing.push(model.name);
    grouped.set(model.providerKey, existing);
  }
  return grouped;
}

export function useModelMenuData() {
  const data = useLazyLoadQuery<useModelMenuDataQuery>(
    graphql`
      query useModelMenuDataQuery {
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
        }
        playgroundModels {
          name
          providerKey
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const modelsByProvider = useMemo(
    () => getModelsByProvider(data.playgroundModels),
    [data.playgroundModels]
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

  const localCredentials: LocalProviderCredentials = useCredentialsContext(
    (state) => state
  );

  // Providers that are usable right now: dependencies installed and
  // credentials satisfied on the server or in the browser.
  const readyProviders: ModelProviderInfo[] = data.modelProviders.filter(
    (provider) => isProviderReady({ provider, localCredentials })
  );

  // Whether the user has explicitly set up any provider — credentials for a
  // built-in provider or a custom provider. Zero-credential providers (e.g.
  // Ollama) are always ready but do not count as provisioned.
  const hasProvisionedProvider =
    customProviders.length > 0 ||
    data.modelProviders.some((provider) =>
      isProviderProvisioned({ provider, localCredentials })
    );

  return {
    availableBuiltinModels,
    availableCustomModels,
    customProviders,
    data,
    hasProvisionedProvider,
    modelCatalog,
    modelsByProvider,
    providerInfoMap,
    readyProviders,
  };
}
