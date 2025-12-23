import { useMemo } from "react";
import debounce from "lodash/debounce";

import { Input, Label, TextField } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type EndpointConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the endpoint URL for Azure OpenAI.
 */
export function EndpointConfigFormField({
  playgroundInstanceId,
}: EndpointConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const debouncedUpdateEndpoint = useMemo(
    () =>
      debounce((value: string) => {
        updateModel({
          instanceId: playgroundInstanceId,
          patch: {
            endpoint: value,
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
      key="endpoint"
      defaultValue={instance.model.endpoint ?? ""}
      onChange={debouncedUpdateEndpoint}
    >
      <Label>Endpoint</Label>
      <Input placeholder="e.x. https://my.openai.azure.com" />
    </TextField>
  );
}
