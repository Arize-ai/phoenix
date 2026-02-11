import { useCallback } from "react";

import {
  Button,
  ButtonProps,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export type SaveModelConfigButtonProps = {
  /**
   * The playground instance ID to save the configuration for
   */
  playgroundInstanceId: number;
  /**
   * Whether the button should be disabled (e.g., due to validation errors)
   */
  isDisabled?: boolean;
  /**
   * The variant of the button
   */
  variant?: ButtonProps["variant"];
  /**
   * The styles to apply to the button
   */
  style?: React.CSSProperties;
};

/**
 * Button to save the current model configuration as the default for the provider.
 * Saves to user preferences for later use.
 */
export function SaveModelConfigButton({
  playgroundInstanceId,
  isDisabled = false,
  variant = "default",
  style,
}: SaveModelConfigButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  const setModelConfigForProvider = usePreferencesContext(
    (state) => state.setModelConfigForProvider
  );

  const notifySuccess = useNotifySuccess();

  const onSaveConfig = useCallback(() => {
    if (!instance) return;

    const {
      // Strip out fields that should not be saved:
      // - supportedInvocationParameters: used for validation only
      // - customProvider: custom providers are separate from built-in providers
      supportedInvocationParameters: _supportedParams,
      customProvider: _customProvider,
      ...modelConfigToSave
    } = instance.model;

    setModelConfigForProvider({
      provider: instance.model.provider,
      modelConfig: modelConfigToSave,
    });

    notifySuccess({
      title: "Model Configuration Saved",
      message: `${ModelProviders[instance.model.provider]} model configuration saved as default for later use.`,
      expireMs: 3000,
    });
  }, [instance, notifySuccess, setModelConfigForProvider]);

  if (!instance) {
    return null;
  }

  const providerName =
    ModelProviders[instance.model.provider] ?? "this provider";

  return (
    <TooltipTrigger delay={0} closeDelay={0}>
      <Button
        size="S"
        variant={variant}
        onPress={onSaveConfig}
        isDisabled={isDisabled}
        style={style}
      >
        Save as Default
      </Button>
      <Tooltip placement="bottom" offset={5}>
        {isDisabled
          ? "Fix custom headers validation errors before saving"
          : `Saves the current configuration as the default for ${providerName}.`}
      </Tooltip>
    </TooltipTrigger>
  );
}
