import { ModelComboBox } from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type PlaygroundModelComboBoxProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * A model combobox connected to the playground store.
 * Wraps the pure ModelComboBox component.
 */
export function PlaygroundModelComboBox({
  playgroundInstanceId,
}: PlaygroundModelComboBoxProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  if (!instance) {
    return null;
  }

  return (
    <ModelComboBox
      provider={instance.model.provider}
      modelName={instance.model.modelName}
      onChange={(modelName) => {
        updateModel({
          instanceId: playgroundInstanceId,
          patch: { modelName },
        });
      }}
    />
  );
}
