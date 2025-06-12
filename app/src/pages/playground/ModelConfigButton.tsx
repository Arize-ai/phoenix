import { Suspense, useCallback, useMemo, useState } from "react";
import { Tooltip, TooltipTrigger } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
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
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  AZURE_OPENAI_API_VERSIONS,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import {
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import { InvocationParametersFormFields } from "./InvocationParametersFormFields";
import { ModelComboBox } from "./ModelComboBox";
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
  // Makes the filled slider track blue
  .ac-slider-controls > .ac-slider-track:first-child::before {
    background: var(--ac-global-color-primary);
  }
  padding: var(--ac-global-dimension-size-200);
  overflow: auto;
`;

function providerSupportsOpenAIConfig(provider: ModelProvider) {
  return provider === "OPENAI" || provider === "OLLAMA";
}

function OpenAiModelConfigFormField({
  instance,
  container,
}: {
  instance: PlaygroundNormalizedInstance;
  container: HTMLElement | null;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateModelConfig = useCallback(
    ({
      configKey,
      value,
    }: {
      configKey: keyof PlaygroundInstance["model"];
      value: string;
    }) => {
      updateModel({
        instanceId: instance.id,
        patch: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
  );

  const debouncedUpdateModelName = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "modelName",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  const debouncedUpdateBaseUrl = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "baseUrl",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  return (
    <>
      <ModelComboBox
        modelName={instance.model.modelName}
        provider={instance.model.provider}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
        container={container ?? undefined}
      />
      <TextField
        key={`${instance.id}-baseUrl-${instance.model.baseUrl}`}
        defaultValue={instance.model.baseUrl ?? ""}
        onChange={(value) => {
          debouncedUpdateBaseUrl(value);
        }}
      >
        <Label>Base URL</Label>
        <Input placeholder="e.x. https://my-llm.com/v1" />
      </TextField>
    </>
  );
}

function AzureOpenAiModelConfigFormField({
  instance,
  container,
}: {
  instance: PlaygroundNormalizedInstance;
  container: HTMLElement | null;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateModelConfig = useCallback(
    ({
      configKey,
      value,
    }: {
      configKey: keyof PlaygroundInstance["model"];
      value: string;
    }) => {
      updateModel({
        instanceId: instance.id,
        patch: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
  );

  const debouncedUpdateModelName = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "modelName",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  return (
    <>
      <TextField
        key={`${instance.id}-modelName-${instance.model.modelName}`}
        defaultValue={instance.model.modelName ?? ""}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      >
        <Label>Deployment Name</Label>
        <Input placeholder="e.x. azure-openai-deployment-name" />
      </TextField>
      <TextField
        value={instance.model.endpoint ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "endpoint",
            value,
          });
        }}
      >
        <Label>Endpoint</Label>
        <Input placeholder="e.x. https://my.openai.azure.com" />
      </TextField>
      <ComboBox
        container={container ?? undefined}
        size="L"
        label="API Version"
        data-testid="azure-api-version-combobox"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api version picker"
        placeholder="Select an AzureOpenAI API Version"
        inputValue={instance.model.apiVersion ?? ""}
        onInputChange={(value) => {
          updateModelConfig({
            configKey: "apiVersion",
            value,
          });
        }}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            updateModelConfig({
              configKey: "apiVersion",
              value: key,
            });
          }
        }}
        allowsCustomValue
      >
        {AZURE_OPENAI_API_VERSIONS.map((version) => (
          <ComboBoxItem key={version} textValue={version} id={version}>
            {version}
          </ComboBoxItem>
        ))}
      </ComboBox>
    </>
  );
}

function BedrockModelConfigFormField({
  instance,
  container,
}: {
  instance: PlaygroundNormalizedInstance;
  container: HTMLElement | null;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateModelConfig = useCallback(
    ({
      configKey,
      value,
    }: {
      configKey: keyof PlaygroundInstance["model"];
      value: string;
    }) => {
      updateModel({
        instanceId: instance.id,
        patch: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
  );

  return (
    <>
      <ComboBox
        container={container ?? undefined}
        size="L"
        label="API"
        data-testid="bedrock-api-combobox"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api picker"
        isDisabled
        placeholder="Select an Bedrock API"
        inputValue={"converse"}
      >
        <ComboBoxItem key="converse" textValue="converse" id="converse">
          Converse
        </ComboBoxItem>
      </ComboBox>
      <ComboBox
        container={container ?? undefined}
        size="L"
        label="Region"
        data-testid="bedrock-region-combobox"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="region picker"
        placeholder="Select an Amazon Region"
        inputValue={"us-east-1"}
        onInputChange={(value) => {
          updateModelConfig({
            configKey: "region",
            value,
          });
        }}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            updateModelConfig({
              configKey: "region",
              value: key,
            });
          }
        }}
        allowsCustomValue
      >
        <ComboBoxItem key="us-east-1" textValue="us-east-1" id="us-east-1">
          N. Virginia (us-east-1)
        </ComboBoxItem>
        <ComboBoxItem key="us-east-2" textValue="us-east-2" id="us-east-2">
          Ohio (us-east-2)
        </ComboBoxItem>
        <ComboBoxItem key="us-west-1" textValue="us-west-1" id="us-west-1">
          N. California (us-west-1)
        </ComboBoxItem>
        <ComboBoxItem key="us-west-2" textValue="us-west-2" id="us-west-2">
          Oregon (us-west-2)
        </ComboBoxItem>
        <ComboBoxItem key="ap-south-1" textValue="ap-south-1" id="ap-south-1">
          Asia Pacific (Mumbai) (ap-south-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-3"
          textValue="ap-northeast-3"
          id="ap-northeast-3"
        >
          Asia Pacific (Osaka) (ap-northeast-3)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-2"
          textValue="ap-northeast-2"
          id="ap-northeast-2"
        >
          Asia Pacific (Seoul) (ap-northeast-2)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-southeast-1"
          textValue="ap-southeast-1"
          id="ap-southeast-1"
        >
          Asia Pacific (Singapore) (ap-southeast-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-southeast-2"
          textValue="ap-southeast-2"
          id="ap-southeast-2"
        >
          Asia Pacific (Sydney) (ap-southeast-2)
        </ComboBoxItem>
        <ComboBoxItem key="ap-east-2" textValue="ap-east-2" id="ap-east-2">
          Asia Pacific (Taipei) (ap-east-2)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-1"
          textValue="ap-northeast-1"
          id="ap-northeast-1"
        >
          Asia Pacific (Tokyo) (ap-northeast-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ca-central-1"
          textValue="ca-central-1"
          id="ca-central-1"
        >
          Canada (Central) (ca-central-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="eu-central-1"
          textValue="eu-central-1"
          id="eu-central-1"
        >
          Europe (Frankfurt) (eu-central-1)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-1" textValue="eu-west-1" id="eu-west-1">
          Europe (Ireland) (eu-west-1)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-2" textValue="eu-west-2" id="eu-west-2">
          Europe (London) (eu-west-2)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-3" textValue="eu-west-3" id="eu-west-3">
          Europe (Paris) (eu-west-3)
        </ComboBoxItem>
        <ComboBoxItem key="eu-north-1" textValue="eu-north-1" id="eu-north-1">
          Europe (Stockholm) (eu-north-1)
        </ComboBoxItem>
        <ComboBoxItem key="sa-east-1" textValue="sa-east-1" id="sa-east-1">
          South America (São Paulo) (sa-east-1)
        </ComboBoxItem>
      </ComboBox>
    </>
  );
}

interface ModelConfigButtonProps extends PlaygroundInstanceProps {}
export function ModelConfigButton(props: ModelConfigButtonProps) {
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

interface ModelConfigDialogProps extends ModelConfigButtonProps {}
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
  const onSaveConfig = useCallback(() => {
    const {
      // Strip out the supported invocation parameters from the model config before saving it as the default these are used for validation and should not be saved
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                leadingVisual={<Icon svg={<Icons.SaveOutline />} />}
              >
                Save as Default
              </Button>
              <Tooltip placement="bottom" offset={5}>
                {/* TODO: make this generic #7855 */}
                <View
                  padding="size-100"
                  backgroundColor="light"
                  borderColor="dark"
                  borderWidth="thin"
                  borderRadius="small"
                  width="200px"
                >
                  Saves the current configuration as the default for{" "}
                  {ModelProviders[instance.model.provider] ?? "this provider"}.
                </View>
              </Tooltip>
            </TooltipTrigger>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense>
          <ModelConfigDialogContent {...props} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

interface ModelConfigDialogContentProps extends ModelConfigButtonProps {}
function ModelConfigDialogContent(props: ModelConfigDialogContentProps) {
  const { playgroundInstanceId } = props;
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (!instance) {
    throw new Error(
      `Playground instance ${props.playgroundInstanceId} not found`
    );
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

  const [container, setContainer] = useState<HTMLElement | null>();

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
        <OpenAiModelConfigFormField
          instance={instance}
          container={container ?? null}
        />
      ) : instance.model.provider === "AZURE_OPENAI" ? (
        <AzureOpenAiModelConfigFormField
          instance={instance}
          container={container ?? null}
        />
      ) : (
        <ModelComboBox
          modelName={instance.model.modelName}
          provider={instance.model.provider}
          onChange={onModelNameChange}
          container={container ?? undefined}
        />
      )}
      {instance.model.provider === "BEDROCK" ? (
        <BedrockModelConfigFormField
          instance={instance}
          container={container ?? null}
        />
      ) : null}
      <Suspense>
        <InvocationParametersFormFields instanceId={playgroundInstanceId} />
      </Suspense>
      <div ref={setContainer} />
    </form>
  );
}
