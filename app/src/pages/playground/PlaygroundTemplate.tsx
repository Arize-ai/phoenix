import React from "react";

import { Button, Card, Icon, Icons } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const id = props.playgroundInstanceId;
  // TODO: remove the hard coding of the first instance
  const instances = usePlaygroundContext((state) => state.instances);
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
