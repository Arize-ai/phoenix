import { Suspense } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { AWSRegionConfigFormField } from "./AWSRegionConfigFormField";
import { BaseUrlConfigFormField } from "./BaseUrlConfigFormField";
import { EndpointConfigFormField } from "./EndpointConfigFormField";
import { ModelInvocationParametersFormFields } from "./ModelInvocationParametersFormFields";
import { ModelNameConfigFormField } from "./ModelNameConfigFormField";
import { SaveModelConfigButton } from "./SaveModelConfigButton";

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
};

export function ModelParametersConfigButton(
  props: ModelParametersConfigButtonProps
) {
  const { playgroundInstanceId } = props;

  const provider = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === playgroundInstanceId)
        ?.model.provider
  );

  // Provider capability flags
  const showBaseUrl = provider === "OPENAI" || provider === "OLLAMA";
  const showAzureFields = provider === "AZURE_OPENAI";
  const showRegion = provider === "AWS";

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

              {/* AWS Bedrock specific fields */}
              {showRegion && (
                <AWSRegionConfigFormField
                  playgroundInstanceId={playgroundInstanceId}
                />
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
