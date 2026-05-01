import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";

import { Button, Flex, Label, TextArea, TextField } from "@phoenix/components";
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
  userInstructions: string;
};

export function AgentSettingsForm() {
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const userInstructionsFromStore = useAgentContext(
    (state) => state.userInstructions
  );
  const setUserInstructions = useAgentContext(
    (state) => state.setUserInstructions
  );

  const { control, handleSubmit, formState, reset } =
    useForm<AgentSettingsFormValues>({
      defaultValues: {
        model: defaultModelConfigToMenuValue(defaultModelConfig),
        userInstructions: userInstructionsFromStore,
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
    setUserInstructions(data.userInstructions);
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
      <Controller
        name="userInstructions"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? undefined}>
            <Label>Custom Instructions</Label>
            <TextArea
              rows={10}
              placeholder="Optional instructions inserted into PXI's system prompt"
            />
          </TextField>
        )}
      />
      <Flex direction="row" gap="size-100" justifyContent="end" width="100%">
        <Button type="submit" variant="primary" isDisabled={!formState.isDirty}>
          Save
        </Button>
      </Flex>
    </form>
  );
}
