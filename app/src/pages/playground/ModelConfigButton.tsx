import React, {
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
  Item,
  Picker,
  TextField,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Button, Flex, Icon, Icons, Text } from "@phoenix/components";
import {
  AZURE_OPENAI_API_VERSIONS,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { PlaygroundInstance } from "@phoenix/store";

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
  instance: PlaygroundInstance;
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
        label="Base URL"
        defaultValue={instance.model.baseUrl ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "baseUrl",
            value,
          });
        }}
      />
    </>
  );
}

function AzureOpenAiModelConfigFormField({
  instance,
}: {
  instance: PlaygroundInstance;
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
        label="Deployment Name"
        defaultValue={instance.model.modelName ?? ""}
        onChange={(value) => {
          debouncedUpdateModelName(value);
        }}
      />
      <TextField
        label="Endpoint"
        defaultValue={instance.model.endpoint ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "endpoint",
            value,
          });
        }}
      />
      <Picker
        label="API Version"
        defaultSelectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api version picker"
        placeholder="Select an AzureOpenAI API Version"
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            updateModelConfig({
              configKey: "apiVersion",
              value: key,
            });
          }
        }}
      >
        {AZURE_OPENAI_API_VERSIONS.map((version) => (
          <Item key={version}>{version}</Item>
        ))}
      </Picker>
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
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text weight="heavy">{ModelProviders[instance.model.provider]}</Text>
          <div
            css={css`
              max-width: ${MODEL_CONFIG_NAME_BUTTON_MAX_WIDTH}px;
              text-overflow: ellipsis;
              overflow: hidden;
              white-space: nowrap;
            `}
          >
            <Text>{instance.model.modelName || "--"}</Text>
          </div>
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
            icon={<Icon svg={<Icons.SaveOutline />} />}
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
        <AzureOpenAiModelConfigFormField instance={instance} />
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
