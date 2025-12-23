import { useMemo } from "react";
import debounce from "lodash/debounce";

import { Input, Label, TextField } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type BaseUrlConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the base URL for a model provider.
 * Used by OpenAI, Ollama, and other providers that support custom endpoints.
 */
export function BaseUrlConfigFormField({
  playgroundInstanceId,
}: BaseUrlConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const debouncedUpdateBaseUrl = useMemo(
    () =>
      debounce((value: string) => {
        updateModel({
          instanceId: playgroundInstanceId,
          patch: {
            baseUrl: value,
          },
        });
      }, 250),
    [playgroundInstanceId, updateModel]
  );

  if (!instance) {
    return null;
  }

  return (
    <TextField
      key="base-url"
      defaultValue={instance.model.baseUrl ?? ""}
      onChange={debouncedUpdateBaseUrl}
    >
      <Label>Base URL</Label>
      <Input placeholder="e.x. https://my-llm.com/v1" />
    </TextField>
  );
}
