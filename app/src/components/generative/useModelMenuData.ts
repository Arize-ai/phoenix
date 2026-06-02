import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
  useModelMenuDataQuery,
} from "./__generated__/useModelMenuDataQuery.graphql";

export type { GenerativeModelSDK, GenerativeProviderKey };
import { getProviderKeyForGenerativeModelSDK } from "./modelProviderUtils";

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

  return {
    availableBuiltinModels,
    availableCustomModels,
    customProviders,
    data,
    modelCatalog,
    modelsByProvider,
    providerInfoMap,
  };
}
