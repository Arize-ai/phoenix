import { useCallback, useMemo } from "react";

import { ModelMenu, ModelMenuValue } from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export type PlaygroundModelMenuProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * A model selection menu connected to the playground store.
 * Handles both provider and model name updates when a model is selected.
 */
export function PlaygroundModelMenu({
  playgroundInstanceId,
}: PlaygroundModelMenuProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  const updateProvider = usePlaygroundContext((state) => state.updateProvider);
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  const value: ModelMenuValue | null = instance?.model.modelName
    ? {
        provider: instance.model.provider,
        modelName: instance.model.modelName,
        customProviderId: instance.model.customProviderId ?? undefined,
      }
    : null;

  // Extract just the model names from the saved configs
  const defaultModelByProvider = useMemo(() => {
    const result: Partial<
      Record<keyof typeof modelConfigByProvider, string | undefined>
    > = {};
    for (const [provider, config] of Object.entries(modelConfigByProvider)) {
      if (config?.modelName) {
        result[provider as keyof typeof modelConfigByProvider] =
          config.modelName;
      }
    }
    return result;
  }, [modelConfigByProvider]);

  const handleChange = useCallback(
    (model: ModelMenuValue) => {
      if (!instance) return;

      // Update provider if it changed
      if (model.provider !== instance.model.provider) {
        updateProvider({
          instanceId: playgroundInstanceId,
          provider: model.provider,
          modelConfigByProvider,
        });
      }

      // Update model name and custom provider info
      updateModel({
        instanceId: playgroundInstanceId,
        patch: {
          modelName: model.modelName,
          customProviderId: model.customProviderId ?? null,
        },
      });
    },
    [
      instance,
      playgroundInstanceId,
      updateProvider,
      updateModel,
      modelConfigByProvider,
    ]
  );

  if (!instance) {
    return null;
  }

  return (
    <ModelMenu
      value={value}
      onChange={handleChange}
      defaultModelByProvider={defaultModelByProvider}
    />
  );
}
