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
  View,
} from "@arizeai/components";

import {
  AZURE_OPENAI_API_VERSIONS,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundInstance } from "@phoenix/store";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import {
  HandleInvocationParameterChange,
  InvocationParametersForm,
} from "./InvocationParametersForm";
import { ModelPicker } from "./ModelPicker";
import { ModelProviderPicker } from "./ModelProviderPicker";
import { PlaygroundInstanceProps } from "./types";

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
        model: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
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
            setDialog(
              <Dialog title="Model Configuration" size="M">
                <Suspense>
                  <ModelConfigDialogContent {...props} />
                </Suspense>
              </Dialog>
            );
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

interface ModelConfigDialogContentProps extends ModelConfigButtonProps {}
function ModelConfigDialogContent(props: ModelConfigDialogContentProps) {
  const { playgroundInstanceId } = props;
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  if (!instance) {
    throw new Error(
      `Playground instance ${props.playgroundInstanceId} not found`
    );
  }
  const query = useLazyLoadQuery<ModelConfigButtonDialogQuery>(
    graphql`
      query ModelConfigButtonDialogQuery($providerKey: GenerativeProviderKey!) {
        ...ModelProviderPickerFragment
        ...ModelPickerFragment @arguments(providerKey: $providerKey)
      }
    `,
    { providerKey: instance.model.provider }
  );

  const onModelNameChange = useCallback(
    (modelName: string) => {
      updateModel({
        instanceId: playgroundInstanceId,
        model: {
          provider: instance.model.provider,
          modelName,
        },
      });
    },
    [instance.model.provider, playgroundInstanceId, updateModel]
  );

  const onInvocationParametersChange: HandleInvocationParameterChange =
    useCallback(
      // TODO(apowell): implement
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (parameterDefinition, value) => {
        updateModel({
          instanceId: playgroundInstanceId,
          model: {
            ...instance.model,
            invocationParameters: [],
          },
        });
      },
      [instance.model, playgroundInstanceId, updateModel]
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
