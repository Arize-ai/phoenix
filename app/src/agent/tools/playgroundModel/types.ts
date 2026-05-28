import type { z } from "zod";

import type { GenerativeModelSDK } from "@phoenix/components/generative/useModelMenuData";
import type { PlaygroundStore } from "@phoenix/store/playground";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

import type { setPlaygroundModelInputSchema } from "./schemas";

export type SetPlaygroundModelInput = z.output<
  typeof setPlaygroundModelInputSchema
>;

export type PlaygroundModelCustomProvider = {
  id: string;
  name: string;
  sdk: GenerativeModelSDK;
  modelNames: readonly string[];
};

export type PlaygroundModelCatalog = {
  installedBuiltInProviders: ReadonlySet<ModelProvider>;
  customProviders: readonly PlaygroundModelCustomProvider[];
};

export type CreateSetPlaygroundModelClientActionOptions = {
  modelCatalog: PlaygroundModelCatalog;
  modelConfigByProvider: ModelConfigByProvider;
  playgroundStore: PlaygroundStore;
  awsBedrockModelPrefix?: string | null;
};
