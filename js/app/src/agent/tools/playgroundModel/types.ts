import type { z } from "zod";

import type {
  AvailableBuiltinModel,
  AvailableCustomModel,
  ModelCatalog,
} from "@phoenix/components/generative/useModelMenuData";
import type { PlaygroundStore } from "@phoenix/store/playground";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

import type {
  listPlaygroundModelTargetsInputSchema,
  setPlaygroundModelInputSchema,
} from "./schemas";

export type ListPlaygroundModelTargetsInput = z.output<
  typeof listPlaygroundModelTargetsInputSchema
>;

export type SetPlaygroundModelInput = z.output<
  typeof setPlaygroundModelInputSchema
>;

export type SetPlaygroundModelTarget = SetPlaygroundModelInput["target"];
export type BuiltinPlaygroundModelTarget = Extract<
  SetPlaygroundModelTarget,
  { type: "builtin" }
>;
export type CustomPlaygroundModelTarget = Extract<
  SetPlaygroundModelTarget,
  { type: "custom" }
>;

export type ListPlaygroundBuiltinModelTarget = {
  target: BuiltinPlaygroundModelTarget;
};

export type ListPlaygroundCustomModelTarget = {
  target: CustomPlaygroundModelTarget;
  customProviderName: string;
  provider: ModelProvider;
};

export type CreateSetPlaygroundModelClientActionOptions = {
  modelCatalog: ModelCatalog;
  modelConfigByProvider: ModelConfigByProvider;
  playgroundStore: PlaygroundStore;
  awsBedrockModelPrefix?: string | null;
};

export type CreateListPlaygroundModelTargetsClientActionOptions = {
  availableBuiltinModels: readonly AvailableBuiltinModel[];
  availableCustomModels: readonly AvailableCustomModel[];
};
