import { useMemo } from "react";
import debounce from "lodash/debounce";

import { Input, Label, TextField } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type ModelNameConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the model name.
 * For Azure OpenAI, displays as "Deployment Name".
 * For other providers, displays as "Model Name".
 */
export function ModelNameConfigFormField({
  playgroundInstanceId,
}: ModelNameConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const debouncedUpdateModelName = useMemo(
    () =>
      debounce((value: string) => {
        updateModel({
          instanceId: playgroundInstanceId,
          patch: {
            modelName: value,
          },
        });
      }, 250),
    [playgroundInstanceId, updateModel]
  );

  if (!instance) {
    return null;
  }

  const provider = instance.model.provider;
  const isAzure = provider === "AZURE_OPENAI";

  const label = isAzure ? "Deployment Name" : "Model Name";
  const placeholder = isAzure
    ? "e.g. azure-openai-deployment-name"
    : "e.g. gpt-4o";

  return (
    <TextField
      key="model-name"
      defaultValue={instance.model.modelName ?? ""}
      onChange={debouncedUpdateModelName}
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </TextField>
  );
}
