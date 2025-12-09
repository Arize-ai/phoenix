import { memo, Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  AWSModelConfigFormFields,
  AzureOpenAIModelConfigFormFields,
  CustomHeadersModelConfigFormField,
  InvocationParametersFormFields,
  ModelComboBox,
  OpenAIModelConfigFormFields,
} from "@phoenix/components/playground/model";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import { ModelProviderSelect } from "./ModelProviderSelect";
import { areRequiredInvocationParametersConfigured } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

/**
 * This is the maximum width of the model config button model name text.
 * This is used to ensure that the model name text does not overflow the model config button.
 */
const MODEL_CONFIG_NAME_BUTTON_MAX_WIDTH = 150;

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

function providerSupportsOpenAIConfig(provider: ModelProvider) {
  return provider === "OPENAI" || provider === "OLLAMA";
}

type ModelConfigButtonProps = PlaygroundInstanceProps;

function ModelConfigButton(props: ModelConfigButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );

  if (!instance) {
    throw new Error(
      `Playground instance ${props.playgroundInstanceId} not found`
    );
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
    <DialogTrigger>
      <Button
        size="S"
        leadingVisual={
          <GenerativeProviderIcon
            provider={instance.model.provider}
            height={16}
          />
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center" height="100%">
          <Truncate maxWidth={MODEL_CONFIG_NAME_BUTTON_MAX_WIDTH}>
            <Text>{instance.model.modelName || "--"}</Text>
          </Truncate>
          {!requiredInvocationParametersConfigured ? (
            <TooltipTrigger delay={0}>
              <span>
                <Icon color="danger" svg={<Icons.InfoOutline />} />
              </span>
              <Tooltip>
                Some required invocation parameters are not configured.
              </Tooltip>
            </TooltipTrigger>
          ) : null}
        </Flex>
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="S">
          <ModelConfigDialog {...props} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

type ModelConfigDialogProps = ModelConfigButtonProps;
function ModelConfigDialog(props: ModelConfigDialogProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );

  if (!instance) {
    throw new Error(
      `Playground instance ${props.playgroundInstanceId} not found`
    );
  }
  const setModelConfigForProvider = usePreferencesContext(
    (state) => state.setModelConfigForProvider
  );

  const notifySuccess = useNotifySuccess();

  const [hasCustomHeadersError, setHasCustomHeadersError] = useState(false);
  const onSaveConfig = useCallback(() => {
    const {
      // Strip out the supported invocation parameters from the model config before saving it as the default these are used for validation and should not be saved

      supportedInvocationParameters: _,
      ...modelConfigWithoutSupportedParams
    } = instance.model;
    setModelConfigForProvider({
      provider: instance.model.provider,
      modelConfig: modelConfigWithoutSupportedParams,
    });
    notifySuccess({
      title: "Model Configuration Saved",
      message: `${ModelProviders[instance.model.provider]} model configuration saved as default for later use.`,
      expireMs: 3000,
    });
  }, [instance.model, notifySuccess, setModelConfigForProvider]);
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Model Configuration</DialogTitle>
          <DialogTitleExtra>
            <TooltipTrigger delay={0} closeDelay={0}>
              <Button
                size="S"
                variant="default"
                onPress={onSaveConfig}
                isDisabled={hasCustomHeadersError}
                leadingVisual={<Icon svg={<Icons.SaveOutline />} />}
              >
                Save as Default
              </Button>
              <Tooltip placement="bottom" offset={5}>
                {hasCustomHeadersError
                  ? "Fix custom headers validation errors before saving"
                  : `Saves the current configuration as the default for ${
                      ModelProviders[instance.model.provider] ?? "this provider"
                    }.`}
              </Tooltip>
            </TooltipTrigger>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense>
          <ModelConfigDialogContent
            {...props}
            onCustomHeadersErrorChange={setHasCustomHeadersError}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const MemoizedModelConfigButton = memo(ModelConfigButton);

export { MemoizedModelConfigButton as ModelConfigButton };

function ModelConfigDialogContent(
  props: ModelConfigButtonProps & {
    onCustomHeadersErrorChange?: (hasError: boolean) => void;
  }
) {
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

  const modelSupportedInvocationParameters =
    instance.model.supportedInvocationParameters;
  const configuredInvocationParameters = instance.model.invocationParameters;
  const requiredInvocationParametersConfigured =
    areRequiredInvocationParametersConfigured(
      configuredInvocationParameters,
      modelSupportedInvocationParameters
    );

  const query = useLazyLoadQuery<ModelConfigButtonDialogQuery>(
    graphql`
      query ModelConfigButtonDialogQuery {
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
      {!requiredInvocationParametersConfigured ? (
        <Flex direction="row" gap="size-100">
          <Icon color="danger" svg={<Icons.InfoOutline />} />
          <Text color="danger">
            Some required invocation parameters are not configured.
          </Text>
        </Flex>
      ) : null}
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
      {providerSupportsOpenAIConfig(instance.model.provider) ? (
        <OpenAIModelConfigFormFields instance={instance} />
      ) : instance.model.provider === "AZURE_OPENAI" ? (
        <AzureOpenAIModelConfigFormFields instance={instance} />
      ) : (
        <ModelComboBox
          modelName={instance.model.modelName}
          provider={instance.model.provider}
          onChange={onModelNameChange}
        />
      )}
      {instance.model.provider === "AWS" ? (
        <AWSModelConfigFormFields instance={instance} />
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
    </form>
  );
}
