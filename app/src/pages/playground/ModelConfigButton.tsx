import React, {
  Fragment,
  ReactNode,
  startTransition,
  Suspense,
  useCallback,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Form,
  Item,
  Picker,
  Text,
  TextField,
  Tooltip,
  TooltipTrigger,
  View,
} from "@arizeai/components";

import {
  AZURE_OPENAI_API_VERSIONS,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { PlaygroundInstance } from "@phoenix/store";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import { InvocationParametersForm } from "./InvocationParametersForm";
import { ModelPicker } from "./ModelPicker";
import { ModelProviderPicker } from "./ModelProviderPicker";
import { PlaygroundInstanceProps } from "./types";

function AzureOpenAiModelConfigFormField({
  instance,
}: {
  instance: PlaygroundInstance;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

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
        model: {
          ...instance.model,
          [configKey]: value,
        },
        modelConfigByProvider,
      });
    },
    [instance.id, instance.model, modelConfigByProvider, updateModel]
  );

  return (
    <>
      <TextField
        label="Deployment Name"
        value={instance.model.modelName ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "modelName",
            value,
          });
        }}
      />
      <TextField
        label="Endpoint"
        value={instance.model.endpoint ?? ""}
        onChange={(value) => {
          updateModelConfig({
            configKey: "endpoint",
            value,
          });
        }}
      />
      <Picker
        label="API Version"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api version picker"
        placeholder="Select an AzureOpenAi API Version"
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
  return (
    <Fragment>
      <Button
        variant="default"
        size="compact"
        onClick={() => {
          startTransition(() => {
            setDialog(<ModelConfigDialog {...props} />);
          });
        }}
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text weight="heavy">{ModelProviders[instance.model.provider]}</Text>
          <Text>{instance.model.modelName || "--"}</Text>
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
    setModelConfigForProvider({
      provider: instance.model.provider,
      modelConfig: instance.model,
    });
    notifySuccess({
      title: "Model Configuration Saved",
      message: `${ModelProviders[instance.model.provider]} model configuration saved`,
      expireMs: 3000,
    });
  }, [instance.model, notifySuccess, setModelConfigForProvider]);
  return (
    <Dialog
      title="Model Configuration"
      size="M"
      extra={
        <TooltipTrigger delay={0} offset={5}>
          <Button size={"compact"} variant="default" onClick={onSaveConfig}>
            Save Config
          </Button>
          <Tooltip>
            Remember configuration for{" "}
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
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const query = useLazyLoadQuery<ModelConfigButtonDialogQuery>(
    graphql`
      query ModelConfigButtonDialogQuery(
        $providerKey: GenerativeProviderKey!
        $modelName: String
      ) {
        ...ModelProviderPickerFragment
        ...ModelPickerFragment
          @arguments(providerKey: $providerKey, modelName: $modelName)
      }
    `,
    {
      providerKey: instance.model.provider,
      modelName: instance.model.modelName,
    }
  );

  const onModelNameChange = useCallback(
    (modelName: string) => {
      updateModel({
        instanceId: playgroundInstanceId,
        model: {
          provider: instance.model.provider,
          modelName,
        },
        modelConfigByProvider,
      });
    },
    [
      instance.model.provider,
      modelConfigByProvider,
      playgroundInstanceId,
      updateModel,
    ]
  );

  return (
    <View padding="size-200" overflow="auto">
      <Form>
        <ModelProviderPicker
          provider={instance.model.provider}
          query={query}
          onChange={(provider) => {
            updateModel({
              instanceId: playgroundInstanceId,
              model: {
                provider,
                modelName: null,
              },
              modelConfigByProvider,
            });
          }}
        />
        {instance.model.provider === "AZURE_OPENAI" ? (
          <AzureOpenAiModelConfigFormField instance={instance} />
        ) : (
          <ModelPicker
            modelName={instance.model.modelName}
            provider={instance.model.provider}
            query={query}
            onChange={onModelNameChange}
          />
        )}
        {instance.model.modelName ? (
          <InvocationParametersForm instance={instance} />
        ) : (
          <></>
        )}
      </Form>
    </View>
  );
}
