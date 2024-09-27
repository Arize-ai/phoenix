import React from "react";

import { Button, Card, Flex, Icon, Icons, View } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const runPlaygroundInstance = usePlaygroundContext(
    (state) => state.runPlaygroundInstance
  );
  const playground = instances.find((instance) => instance.id === instanceId);
  if (!playground) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { template } = playground;

  return (
    <Card
      title="Template"
      collapsible
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        instances.length >= NUM_MAX_PLAYGROUND_INSTANCES ? (
          <DeleteButton {...props} />
        ) : (
          <CompareButton />
        )
      }
    >
      {template.__type === "chat" ? (
        <PlaygroundChatTemplate {...props} />
      ) : (
        "Completion Template"
      )}
      <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
        <Flex direction="row" gap="size-100" alignItems="end">
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              runPlaygroundInstance(instanceId);
            }}
          >
            Run
          </Button>
        </Flex>
      </View>
    </Card>
  );
}

function CompareButton() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);
  return (
    <Button
      variant="default"
      size="compact"
      icon={<Icon svg={<Icons.ArrowCompareOutline />} />}
      onClick={() => {
        addInstance();
      }}
    />
  );
}

function DeleteButton(props: PlaygroundInstanceProps) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);
  return (
    <Button
      variant="default"
      size="compact"
      icon={<Icon svg={<Icons.TrashOutline />} />}
      onClick={() => {
        deleteInstance(props.playgroundInstanceId);
      }}
    />
  );
}
