import { useMemo } from "react";
import debounce from "lodash/debounce";

import { Input, Label, TextField } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type DeploymentNameConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the deployment name (model name) for Azure OpenAI.
 */
export function DeploymentNameConfigFormField({
  playgroundInstanceId,
}: DeploymentNameConfigFormFieldProps) {
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

  return (
    <TextField
      key="model-name"
      defaultValue={instance.model.modelName ?? ""}
      onChange={debouncedUpdateModelName}
    >
      <Label>Deployment Name</Label>
      <Input placeholder="e.x. azure-openai-deployment-name" />
    </TextField>
  );
}
