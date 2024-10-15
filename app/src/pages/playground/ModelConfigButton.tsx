import React, {
  Fragment,
  ReactNode,
  startTransition,
  Suspense,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Form,
  Text,
  View,
} from "@arizeai/components";

import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { ModelConfigButtonDialogQuery } from "./__generated__/ModelConfigButtonDialogQuery.graphql";
import { ModelPicker } from "./ModelPicker";
import { ModelProviderPicker } from "./ModelProviderPicker";
import { PlaygroundInstanceProps } from "./types";

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
  return (
    <View padding="size-200">
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
        <ModelPicker
          modelName={instance.model.modelName}
          provider={instance.model.provider}
          query={query}
          onChange={(modelName) => {
            updateModel({
              instanceId: playgroundInstanceId,
              model: {
                provider: instance.model.provider,
                modelName,
              },
            });
          }}
        />
      </Form>
    </View>
  );
}
