import { Suspense } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { AWSRegionConfigFormField } from "./AWSRegionConfigFormField";
import { BaseUrlConfigFormField } from "./BaseUrlConfigFormField";
import { EndpointConfigFormField } from "./EndpointConfigFormField";
import { ModelInvocationParametersFormFields } from "./ModelInvocationParametersFormFields";
import { ModelNameConfigFormField } from "./ModelNameConfigFormField";
import { SaveModelConfigButton } from "./SaveModelConfigButton";

/**
 * Displays information about an environment variable that will be used for routing.
 * Shown when ephemeral routing is disabled and no custom provider is selected.
 */
function EnvVarRoutingInfo({
  label,
  envVarName,
}: {
  label: string;
  envVarName: string;
}) {
  return (
    <Flex direction="column" gap="size-50">
      <Text weight="heavy" size="S" color="text-700">
        {label}
      </Text>
      <View
        backgroundColor="grey-100"
        padding="size-100"
        borderRadius="small"
        borderWidth="thin"
        borderColor="grey-400"
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Icon svg={<Icons.InfoOutline />} color="info" />
          <Flex direction="column" gap="size-25">
            <Text size="S" color="text-700">
              From environment variable
            </Text>
            <Text size="S" color="text-500" fontStyle="italic">
              {envVarName}
            </Text>
          </Flex>
        </Flex>
      </View>
    </Flex>
  );
}

const formFieldsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
  .ac-field,
  .ac-dropdown,
  .ac-dropdown-button,
  .ac-slider {
    width: 100%;
  }
`;

export type ModelParametersConfigButtonProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
  /**
   * Whether to disable ephemeral routing fields.
   * When true, shows env var info instead of editable fields for providers that need routing.
   */
  disableEphemeralRouting?: boolean;
};

export function ModelParametersConfigButton(
  props: ModelParametersConfigButtonProps
) {
  const { playgroundInstanceId, disableEphemeralRouting } = props;

  const model = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === playgroundInstanceId)
        ?.model
  );

  const provider = model?.provider;
  const customProviderId = model?.customProviderId;
  const customProviderName = model?.customProviderName;

  // When a custom provider is selected, hide routing fields (they come from the provider config)
  const hasCustomProvider = !!customProviderId;

  // Provider capability flags - only show routing fields for built-in providers
  // When disableEphemeralRouting is true, we show env var info instead of editable fields
  const needsBaseUrl = provider === "OPENAI" || provider === "OLLAMA";
  const needsAzureFields = provider === "AZURE_OPENAI";
  const needsRegion = provider === "AWS";

  const showBaseUrl =
    !hasCustomProvider && !disableEphemeralRouting && needsBaseUrl;
  const showAzureFields =
    !hasCustomProvider && !disableEphemeralRouting && needsAzureFields;
  const showRegion =
    !hasCustomProvider && !disableEphemeralRouting && needsRegion;

  // Show env var info when ephemeral routing is disabled and no custom provider
  const showEnvVarInfo = disableEphemeralRouting && !hasCustomProvider;

  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="S"
        aria-label="Configure model parameters"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
      />
      <Popover>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200" overflow="auto" width="400px">
            <div css={formFieldsCSS}>
              {/* Model name field - shown for all providers */}
              <ModelNameConfigFormField
                playgroundInstanceId={playgroundInstanceId}
              />

              {/* Custom provider info - shown when a custom provider is selected */}
              {hasCustomProvider && customProviderName && (
                <Flex direction="column" gap="size-50">
                  <Text weight="heavy" size="S" color="text-700">
                    Custom Provider
                  </Text>
                  <Text size="S">{customProviderName}</Text>
                </Flex>
              )}

              {/* OpenAI / Ollama specific fields */}
              {showBaseUrl && (
                <BaseUrlConfigFormField
                  playgroundInstanceId={playgroundInstanceId}
                />
              )}

              {/* Azure OpenAI specific fields */}
              {showAzureFields && (
                <EndpointConfigFormField
                  playgroundInstanceId={playgroundInstanceId}
                />
              )}
              {showEnvVarInfo && needsAzureFields && (
                <EnvVarRoutingInfo
                  label="Endpoint"
                  envVarName="AZURE_OPENAI_ENDPOINT"
                />
              )}

              {/* AWS Bedrock specific fields */}
              {showRegion && (
                <AWSRegionConfigFormField
                  playgroundInstanceId={playgroundInstanceId}
                />
              )}
              {showEnvVarInfo && needsRegion && (
                <EnvVarRoutingInfo label="Region" envVarName="AWS_REGION" />
              )}

              <Suspense>
                <ModelInvocationParametersFormFields
                  playgroundInstanceId={playgroundInstanceId}
                />
              </Suspense>
            </div>
          </View>
          <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
            <SaveModelConfigButton
              playgroundInstanceId={playgroundInstanceId}
              variant="quiet"
              style={{
                width: "100%",
              }}
            />
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
