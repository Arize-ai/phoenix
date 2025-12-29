import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { ModelConfigFormFieldsQuery } from "./__generated__/ModelConfigFormFieldsQuery.graphql";
import { AWSRegionConfigFormField } from "./AWSRegionConfigFormField";
import { BaseUrlConfigFormField } from "./BaseUrlConfigFormField";
import { DeploymentNameConfigFormField } from "./DeploymentNameConfigFormField";
import { EndpointConfigFormField } from "./EndpointConfigFormField";
import { ModelInvocationParametersFormFields } from "./ModelInvocationParametersFormFields";
import { ModelProviderSelect } from "./ModelProviderSelect";
import { PlaygroundModelComboBox } from "./PlaygroundModelComboBox";

const modelConfigFormCSS = css`
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
  padding: var(--ac-global-dimension-size-200);
  overflow: auto;
`;

export type ModelConfigFormFieldsProps = {
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
 * Reusable form fields for configuring a playground model.
 * Declaratively shows/hides fields based on the provider.
 */
export function ModelConfigFormFields(props: ModelConfigFormFieldsProps) {
  const { playgroundInstanceId, onCustomHeadersErrorChange } = props;

  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (!instance) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  const updateProvider = usePlaygroundContext((state) => state.updateProvider);

  const query = useLazyLoadQuery<ModelConfigFormFieldsQuery>(
    graphql`
      query ModelConfigFormFieldsQuery {
        ...ModelProviderSelectFragment
      }
    `,
    {}
  );

  const provider = instance.model.provider;

  // Provider capability flags
  const showModelComboBox = provider !== "AZURE_OPENAI";
  const showBaseUrl = provider === "OPENAI" || provider === "OLLAMA";
  const showAzureFields = provider === "AZURE_OPENAI";
  const showRegion = provider === "AWS";

  return (
    <form css={modelConfigFormCSS}>
      <ModelProviderSelect
        provider={provider}
        query={query}
        onChange={(newProvider) => {
          updateProvider({
            instanceId: playgroundInstanceId,
            provider: newProvider,
            modelConfigByProvider,
          });
        }}
      />

      {/* Model selection - shown for all providers except Azure (which uses deployment name) */}
      {showModelComboBox && (
        <PlaygroundModelComboBox playgroundInstanceId={playgroundInstanceId} />
      )}

      {/* OpenAI / Ollama specific fields */}
      {showBaseUrl && (
        <BaseUrlConfigFormField playgroundInstanceId={playgroundInstanceId} />
      )}

      {/* Azure OpenAI specific fields */}
      {showAzureFields && (
        <>
          <DeploymentNameConfigFormField
            playgroundInstanceId={playgroundInstanceId}
          />
          <EndpointConfigFormField
            playgroundInstanceId={playgroundInstanceId}
          />
        </>
      )}

      {/* AWS Bedrock specific fields */}
      {showRegion && (
        <AWSRegionConfigFormField playgroundInstanceId={playgroundInstanceId} />
      )}

      <ModelInvocationParametersFormFields
        playgroundInstanceId={playgroundInstanceId}
        onCustomHeadersErrorChange={onCustomHeadersErrorChange}
      />
    </form>
  );
}
