import { css } from "@emotion/react";
import { Suspense, useCallback, useState } from "react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  getInvocationFamilyForProvider,
  InvocationFamily,
} from "@phoenix/pages/playground/invocationParameterSpecs";
import { areRequiredInvocationParametersConfigured } from "@phoenix/pages/playground/playgroundUtils";

import { CustomHeadersModelConfigFormField } from "./CustomHeadersModelConfigFormField";
import { ExtraBodyModelConfigFormField } from "./ExtraBodyModelConfigFormField";
import { InvocationParametersFormFields } from "./InvocationParametersFormFields";

const modelParametersFormCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  .field,
  .dropdown,
  .dropdown__button,
  .slider {
    width: 100%;
  }
  .slider__controls > .slider__track:first-child::before {
    background: var(--global-color-primary);
  }
`;

export type ModelInvocationParametersFormFieldsProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  /**
   * Fired when the validity of any JSON-object field (custom headers, extra
   * body) flips. Use this to disable downstream save actions so users can't
   * persist a stale "last good" value while invalid text is in the editor.
   */
  onValidityChange?: (isValid: boolean) => void;
};

/**
 * Reusable form fields for configuring model invocation parameters and custom headers.
 * This component can be used independently in places like ModelParametersConfigButton.
 */
export function ModelInvocationParametersFormFields(
  props: ModelInvocationParametersFormFieldsProps
) {
  const { playgroundInstanceId, onValidityChange } = props;
  const [headersHasError, setHeadersHasError] = useState(false);
  const [extraBodyHasError, setExtraBodyHasError] = useState(false);

  const reportValidity = useCallback(
    (next: { headers?: boolean; extraBody?: boolean }) => {
      const headers = next.headers ?? headersHasError;
      const extraBody = next.extraBody ?? extraBodyHasError;
      onValidityChange?.(!(headers || extraBody));
    },
    [headersHasError, extraBodyHasError, onValidityChange]
  );

  const handleHeadersErrorChange = useCallback(
    (hasError: boolean) => {
      setHeadersHasError(hasError);
      reportValidity({ headers: hasError });
    },
    [reportValidity]
  );

  const handleExtraBodyErrorChange = useCallback(
    (hasError: boolean) => {
      setExtraBodyHasError(hasError);
      reportValidity({ extraBody: hasError });
    },
    [reportValidity]
  );

  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (!instance) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const requiredInvocationParametersConfigured =
    areRequiredInvocationParametersConfigured(
      instance.model.invocationParameters,
      instance.model
    );
  const invocationFamily = getInvocationFamilyForProvider(
    instance.model.provider
  );
  const canConfigureExtraBody =
    invocationFamily === InvocationFamily.OPENAI ||
    invocationFamily === InvocationFamily.ANTHROPIC;

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
          onErrorChange={handleHeadersErrorChange}
        />
      )}
      {canConfigureExtraBody ? (
        <ExtraBodyModelConfigFormField
          key={`${instance.model.provider}-extra-body`}
          instance={instance}
          onErrorChange={handleExtraBodyErrorChange}
        />
      ) : null}
    </div>
  );
}
