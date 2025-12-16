import { Suspense } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { areRequiredInvocationParametersConfigured } from "@phoenix/pages/playground/playgroundUtils";

import { CustomHeadersModelConfigFormField } from "./CustomHeadersModelConfigFormField";
import { InvocationParametersFormFields } from "./InvocationParametersFormFields";

const modelParametersFormCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
  .ac-field,
  .ac-dropdown,
  .ac-dropdown-button,
  .ac-slider {
    width: 100%;
  }
  .ac-slider-controls > .ac-slider-track:first-child::before {
    background: var(--ac-global-color-primary);
  }
`;

export type ModelInvocationParametersFormFieldsProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  /**
   * Callback when custom headers validation error state changes
   */
  onCustomHeadersErrorChange?: (hasError: boolean) => void;
};

/**
 * Reusable form fields for configuring model invocation parameters and custom headers.
 * This component can be used independently in places like ModelParametersConfigButton.
 */
export function ModelInvocationParametersFormFields(
  props: ModelInvocationParametersFormFieldsProps
) {
  const { playgroundInstanceId, onCustomHeadersErrorChange } = props;

  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (!instance) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const modelSupportedInvocationParameters =
    instance.model.supportedInvocationParameters;
  const configuredInvocationParameters = instance.model.invocationParameters;
  const requiredInvocationParametersConfigured =
    areRequiredInvocationParametersConfigured(
      configuredInvocationParameters,
      modelSupportedInvocationParameters
    );

  return (
    <div css={modelParametersFormCSS}>
      {!requiredInvocationParametersConfigured ? (
        <Flex direction="row" gap="size-100">
          <Icon color="danger" svg={<Icons.InfoOutline />} />
          <Text color="danger">
            Some required invocation parameters are not configured.
          </Text>
        </Flex>
      ) : null}
      <Suspense>
        <InvocationParametersFormFields instanceId={playgroundInstanceId} />
      </Suspense>
      {instance.model.provider !== "GOOGLE" && (
        <CustomHeadersModelConfigFormField
          key={instance.model.provider}
          instance={instance}
          onErrorChange={onCustomHeadersErrorChange}
        />
      )}
    </div>
  );
}
