import { useCallback, useMemo } from "react";
import debounce from "lodash/debounce";

import { Input, Label, TextField } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

import { ModelComboBox } from "./ModelComboBox";

export function OpenAIModelConfigFormFields({
  instance,
}: {
  instance: PlaygroundNormalizedInstance;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateModelConfig = useCallback(
    ({
      configKey,
      value,
    }: {
      configKey: keyof PlaygroundInstance["model"];
      value: string;
    }) => {
      updateModel({
        instanceId: instance.id,
        patch: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
  );

  const debouncedUpdateModelName = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "modelName",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  const debouncedUpdateBaseUrl = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "baseUrl",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  return (
    <>
      <ModelComboBox
        modelName={instance.model.modelName}
        provider={instance.model.provider}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      />
      <TextField
        key="base-url"
        defaultValue={instance.model.baseUrl ?? ""}
        onChange={(value) => {
          debouncedUpdateBaseUrl(value);
        }}
      >
        <Label>Base URL</Label>
        <Input placeholder="e.x. https://my-llm.com/v1" />
      </TextField>
    </>
  );
}
