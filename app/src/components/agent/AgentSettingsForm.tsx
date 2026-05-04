import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";

import { Button, Flex, Label } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { ModelConfig } from "@phoenix/store/playground/types";

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

export type AgentSettingsFormValues = {
  model: ModelMenuValue;
};

export function AgentSettingsForm() {
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );

  const { control, handleSubmit, formState, reset } =
    useForm<AgentSettingsFormValues>({
      defaultValues: {
        model: defaultModelConfigToMenuValue(defaultModelConfig),
      },
    });

  const onSubmit = (data: AgentSettingsFormValues) => {
    const { defaultModelConfig: current } = store.getState();
    setDefaultModelConfig({
      ...current,
      provider: data.model.provider,
      modelName: data.model.modelName,
      customProvider: data.model.customProvider ?? null,
    });
    reset(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-150);
      `}
    >
      <div css={fieldBaseCSS}>
        <Label>Agent Model</Label>
        <Controller
          name="model"
          control={control}
          render={({ field }) => (
            <AgentModelMenu value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <Flex direction="row" gap="size-100" justifyContent="end" width="100%">
        <Button type="submit" variant="primary" isDisabled={!formState.isDirty}>
          Save
        </Button>
      </Flex>
    </form>
  );
}
