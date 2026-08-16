import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Alert, Label } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { ModelConfig } from "@phoenix/store/playground/types";

import { isAgentCuratedModelSelection } from "./agentCuratedModels";
import { AgentModelMenu } from "./AgentModelMenu";

function defaultModelConfigToMenuValue(config: ModelConfig): ModelMenuValue {
  return {
    provider: config.provider,
    modelName: config.modelName ?? "",
    ...(config.customProvider && {
      customProvider: config.customProvider,
    }),
  };
}

export function AgentSettingsForm({ children }: { children?: ReactNode }) {
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );

  const selectedModel = defaultModelConfigToMenuValue(defaultModelConfig);
  const isRecommendedModel = isAgentCuratedModelSelection(selectedModel);

  const handleModelChange = (model: ModelMenuValue) => {
    const { defaultModelConfig: current } = store.getState();
    setDefaultModelConfig({
      ...current,
      provider: model.provider,
      modelName: model.modelName,
      customProvider: model.customProvider ?? null,
    });
  };

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-150);
      `}
    >
      <div css={fieldBaseCSS}>
        <Label>Assistant model</Label>
        <AgentModelMenu
          value={selectedModel}
          onChange={handleModelChange}
          limitToCuratedModels={false}
        />
        {!isRecommendedModel && (
          <Alert
            variant="warning"
            css={css`
              margin-top: var(--global-dimension-size-100);
            `}
          >
            This model has not been verified with the assistant and may fail or
            behave poorly.
          </Alert>
        )}
      </div>
      {children}
    </div>
  );
}
