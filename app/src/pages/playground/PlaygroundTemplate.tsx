import React from "react";

import { Button, Card, Icon, Icons, View } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const id = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const runPlaygrounds = usePlaygroundContext((state) => state.runPlaygrounds);
  const playground = instances.find((instance) => instance.id === id);
  if (!playground) {
    throw new Error(`Playground instance ${id} not found`);
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
        <Button
          variant="primary"
          onClick={() => {
            // TODO: Only run this one instance
            runPlaygrounds();
          }}
        >
          Run
        </Button>
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
