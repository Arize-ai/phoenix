import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";

import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";
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
  systemPrompt: string;
};

export function AgentSettingsForm() {
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const systemPromptFromStore = useAgentContext((state) => state.systemPrompt);
  const setSystemPrompt = useAgentContext((state) => state.setSystemPrompt);

  const { control, handleSubmit, formState, reset } =
    useForm<AgentSettingsFormValues>({
      defaultValues: {
        model: defaultModelConfigToMenuValue(defaultModelConfig),
        systemPrompt: systemPromptFromStore,
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
    setSystemPrompt(data.systemPrompt);
    reset(data);
  };

  const handleReset = () => {
    const { defaultModelConfig: modelConfig } = store.getState();
    setSystemPrompt(AGENT_SYSTEM_PROMPT);
    reset({
      model: defaultModelConfigToMenuValue(modelConfig),
      systemPrompt: AGENT_SYSTEM_PROMPT,
    });
  };

  const resetDisabled =
    !formState.isDirty && systemPromptFromStore === AGENT_SYSTEM_PROMPT;

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
        name="systemPrompt"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? undefined}>
            <Label>System Prompt</Label>
            <TextArea
              rows={50}
              placeholder="The system instructions to the assistant"
            />
          </TextField>
        )}
      />
      <Flex direction="row" gap="size-100" justifyContent="end" width="100%">
        <Button
          type="button"
          variant="default"
          isDisabled={resetDisabled}
          onPress={handleReset}
        >
          Reset
        </Button>
        <Button type="submit" variant="primary" isDisabled={!formState.isDirty}>
          Save
        </Button>
      </Flex>
    </form>
  );
}
