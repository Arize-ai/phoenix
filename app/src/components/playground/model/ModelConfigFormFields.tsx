import { useCallback } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { PlaygroundNormalizedInstance } from "@phoenix/store";

import { ModelConfigFormFieldsQuery } from "./__generated__/ModelConfigFormFieldsQuery.graphql";
import { AWSModelConfigFormFields } from "./AWSModelConfigFormFields";
import { AzureOpenAIModelConfigFormFields } from "./AzureOpenAIModelConfigFormFields";
import { ModelComboBox } from "./ModelComboBox";
import { ModelInvocationParametersFormFields } from "./ModelInvocationParametersFormFields";
import { ModelProviderSelect } from "./ModelProviderSelect";
import { OpenAIModelConfigFormFields } from "./OpenAIModelConfigFormFields";

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
 * This component can be used in different contexts like the ModelConfigButton dialog.
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
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const query = useLazyLoadQuery<ModelConfigFormFieldsQuery>(
    graphql`
      query ModelConfigFormFieldsQuery {
        ...ModelProviderSelectFragment
      }
    `,
    {}
  );

  const onModelNameChange = useCallback(
    (modelName: string) => {
      updateModel({
        instanceId: playgroundInstanceId,
        patch: {
          modelName,
        },
      });
    },
    [playgroundInstanceId, updateModel]
  );

  return (
    <form css={modelConfigFormCSS}>
      <ModelProviderSelect
        provider={instance.model.provider}
        query={query}
        onChange={(provider) => {
          updateProvider({
            instanceId: playgroundInstanceId,
            provider,
            modelConfigByProvider,
          });
        }}
      />
      <ProviderModelConfigFields
        instance={instance}
        onModelNameChange={onModelNameChange}
      />
      <ModelInvocationParametersFormFields
        playgroundInstanceId={playgroundInstanceId}
        onCustomHeadersErrorChange={onCustomHeadersErrorChange}
      />
    </form>
  );
}

function providerSupportsOpenAIConfig(provider: ModelProvider) {
  return provider === "OPENAI" || provider === "OLLAMA";
}

/**
 * Renders the appropriate model configuration fields based on the provider
 */
function ProviderModelConfigFields({
  instance,
  onModelNameChange,
}: {
  instance: PlaygroundNormalizedInstance;
  onModelNameChange: (modelName: string) => void;
}) {
  const provider = instance.model.provider;

  return (
    <>
      {providerSupportsOpenAIConfig(provider) ? (
        <OpenAIModelConfigFormFields instance={instance} />
      ) : provider === "AZURE_OPENAI" ? (
        <AzureOpenAIModelConfigFormFields instance={instance} />
      ) : (
        <ModelComboBox
          modelName={instance.model.modelName}
          provider={provider}
          onChange={onModelNameChange}
        />
      )}
      {provider === "AWS" && <AWSModelConfigFormFields instance={instance} />}
    </>
  );
}
