import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { JSONSchema7 } from "json-schema";
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
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { AwsModelConfigFormFields } from "@phoenix/components/playground/model/AWSModelConfigFormFields";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  AZURE_OPENAI_API_VERSIONS,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import {
  httpHeadersJSONSchema,
  stringToHttpHeadersSchema,
} from "@phoenix/schemas/httpHeadersSchema";
import {
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

import { ModelComboBox } from "@phoenix/components/playground/model/ModelComboBox";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import { InvocationParametersFormFields } from "./InvocationParametersFormFields";
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

function OpenAiModelConfigFormField({
  instance,
}: {
  instance: PlaygroundNormalizedInstance;
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
      />
      <TextField
        key="base-url"
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
}: {
  instance: PlaygroundNormalizedInstance;
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

  const debouncedUpdateEndpoint = useMemo(
    () =>
      debounce((value: string) => {
        updateModelConfig({
          configKey: "endpoint",
          value,
        });
      }, 250),
    [updateModelConfig]
  );

  return (
    <>
      <TextField
        key="model-name"
        defaultValue={instance.model.modelName ?? ""}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      >
        <Label>Deployment Name</Label>
        <Input placeholder="e.x. azure-openai-deployment-name" />
      </TextField>
      <TextField
        key="endpoint"
        defaultValue={instance.model.endpoint ?? ""}
        onChange={(value) => {
          debouncedUpdateEndpoint(value);
        }}
      >
        <Label>Endpoint</Label>
        <Input placeholder="e.x. https://my.openai.azure.com" />
      </TextField>
      <ComboBox
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

/**
 * Format headers object for JSON editor with proper indentation and empty state handling
 */
const formatHeadersForEditor = (
  headers: Record<string, string> | null | undefined
): string => {
  if (!headers) {
    return "{\n  \n}";
  }

  const hasContent = Object.keys(headers).length > 0;
  return hasContent ? JSON.stringify(headers, null, 2) : "{\n  \n}";
};

function CustomHeadersModelConfigFormField({
  instance,
  onErrorChange,
}: {
  instance: PlaygroundNormalizedInstance;
  onErrorChange?: (hasError: boolean) => void;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const { customHeaders } = instance.model;

  const [editorValue, setEditorValue] = useState(() =>
    formatHeadersForEditor(customHeaders)
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Cleanup: reset error state when component unmounts
  useEffect(() => {
    return () => onErrorChange?.(false);
  }, [onErrorChange]);

  const handleChange = useCallback(
    (value: string) => {
      setEditorValue(value);

      const result = stringToHttpHeadersSchema.safeParse(value);
      if (result.success) {
        setErrorMessage(undefined);
        onErrorChange?.(false);
        updateModel({
          instanceId: instance.id,
          patch: { customHeaders: result.data },
        });
      } else {
        const firstError = result.error.errors[0];
        setErrorMessage(
          firstError?.message ??
            firstError?.path?.join(".") ??
            "Invalid headers format"
        );
        onErrorChange?.(true);
      }
    },
    [instance.id, updateModel, onErrorChange]
  );

  return (
    <div css={fieldContainerCSS}>
      <div css={fieldBaseCSS}>
        <Label>Custom Headers</Label>
        <CodeWrap>
          <JSONEditor
            value={editorValue}
            onChange={handleChange}
            jsonSchema={httpHeadersJSONSchema as JSONSchema7}
            optionalLint
            placeholder={`{"X-Custom-Header": "custom-value"}`}
          />
        </CodeWrap>
        {errorMessage ? (
          <Text slot="errorMessage" color="danger">
            {errorMessage}
          </Text>
        ) : null}
        {!errorMessage ? (
          <Text slot="description">
            Custom HTTP headers to send with requests to the LLM provider
          </Text>
        ) : null}
      </div>
    </div>
  );
}

const fieldContainerCSS = css`
  & .ac-view {
    width: 100%;
  }
`;

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
        <OpenAiModelConfigFormField instance={instance} />
      ) : instance.model.provider === "AZURE_OPENAI" ? (
        <AzureOpenAiModelConfigFormField instance={instance} />
      ) : (
        <ModelComboBox
          modelName={instance.model.modelName}
          provider={instance.model.provider}
          onChange={onModelNameChange}
        />
      )}
      {instance.model.provider === "AWS" ? (
        <AwsModelConfigFormFields instance={instance} />
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
