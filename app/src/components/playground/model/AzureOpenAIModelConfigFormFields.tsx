import { useCallback, useMemo } from "react";
import debounce from "lodash/debounce";

import {
  ComboBox,
  ComboBoxItem,
  Input,
  Label,
  TextField,
} from "@phoenix/components";
import { AZURE_OPENAI_API_VERSIONS } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

export function AzureOpenAIModelConfigFormFields({
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

  const debouncedUpdateEndpoint = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "endpoint",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  return (
    <>
      <TextField
        key="model-name"
        defaultValue={instance.model.modelName ?? ""}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      >
        <Label>Deployment Name</Label>
        <Input placeholder="e.x. azure-openai-deployment-name" />
      </TextField>
      <TextField
        key="endpoint"
        defaultValue={instance.model.endpoint ?? ""}
        onChange={(value) => {
          debouncedUpdateEndpoint(value);
        }}
      >
        <Label>Endpoint</Label>
        <Input placeholder="e.x. https://my.openai.azure.com" />
      </TextField>
      <ComboBox
        size="L"
        label="API Version"
        data-testid="azure-api-version-combobox"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api version picker"
        placeholder="Select an AzureOpenAI API Version"
        inputValue={instance.model.apiVersion ?? ""}
        onInputChange={(value) => {
          updateModelConfig({
            configKey: "apiVersion",
            value,
          });
        }}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            updateModelConfig({
              configKey: "apiVersion",
              value: key,
            });
          }
        }}
        allowsCustomValue
      >
        {AZURE_OPENAI_API_VERSIONS.map((version) => (
          <ComboBoxItem key={version} textValue={version} id={version}>
            {version}
          </ComboBoxItem>
        ))}
      </ComboBox>
    </>
  );
}
