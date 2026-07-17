import type { ModelConfig } from "@phoenix/store/playground/types";

import type { AgentModelSelection } from "./buildAgentChatRequestBody";

export function buildAgentModelSelectionFromConfig(
  modelConfig: ModelConfig
): AgentModelSelection {
  if (modelConfig.customProvider) {
    return {
      providerType: "custom",
      providerId: modelConfig.customProvider.id,
      modelName: modelConfig.modelName ?? "",
    };
  }

  const isOpenAIProvider =
    modelConfig.provider === "OPENAI" ||
    modelConfig.provider === "AZURE_OPENAI";
  return {
    providerType: "builtin",
    provider: modelConfig.provider,
    modelName: modelConfig.modelName ?? "",
    ...(isOpenAIProvider && { openaiApiType: "responses" }),
  };
}
