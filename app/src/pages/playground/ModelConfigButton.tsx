import {
  Fragment,
  ReactNode,
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import {
  Dialog,
  DialogContainer,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextField,
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
import { ModelProviderPicker } from "./ModelProviderPicker";
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
        defaultValue={instance.model.baseUrl ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "baseUrl",
            value,
          });
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
        defaultValue={instance.model.modelName ?? ""}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      >
        <Label>Deployment Name</Label>
        <Input placeholder="e.x. azure-openai-deployment-name" />
      </TextField>
      <TextField
        defaultValue={instance.model.endpoint ?? ""}
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

interface ModelConfigButtonProps extends PlaygroundInstanceProps {}
export function ModelConfigButton(props: ModelConfigButtonProps) {
  const [dialog, setDialog] = useState<ReactNode>(null);
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
    <Fragment>
      <Button
        size="S"
        onPress={() => {
          startTransition(() => {
            setDialog(<ModelConfigDialog {...props} />);
          });
        }}
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
            <TooltipTrigger delay={0} offset={5}>
              <span>
                <TriggerWrap>
                  <Icon color="danger" svg={<Icons.InfoOutline />} />
                </TriggerWrap>
              </span>
              <Tooltip>
                Some required invocation parameters are not configured.
              </Tooltip>
            </TooltipTrigger>
          ) : null}
        </Flex>
      </Button>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </Fragment>
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
    <Dialog
      title="Model Configuration"
      size="M"
      extra={
        <TooltipTrigger delay={0} offset={5}>
          <Button
            size="S"
            variant="default"
            onPress={onSaveConfig}
            leadingVisual={<Icon svg={<Icons.SaveOutline />} />}
          >
            Save as Default
          </Button>
          <Tooltip>
            Saves the current configuration as the default for{" "}
            {ModelProviders[instance.model.provider] ?? "this provider"}.
          </Tooltip>
        </TooltipTrigger>
      }
    >
      <Suspense>
        <ModelConfigDialogContent {...props} />
      </Suspense>
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
        ...ModelProviderPickerFragment
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
      <ModelProviderPicker
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
      {instance.model.provider === "OPENAI" ? (
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
      <Suspense>
        <InvocationParametersFormFields instanceId={playgroundInstanceId} />
      </Suspense>
      <div ref={setContainer} />
    </form>
  );
}
