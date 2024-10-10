import React from "react";

import {
  Button,
  Card,
  Content,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { template } = instance;

  return (
    <Card
      title="Prompt"
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
    <TooltipTrigger>
      <TriggerWrap>
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.TrashOutline />} />}
          onClick={() => {
            deleteInstance(props.playgroundInstanceId);
          }}
        />
      </TriggerWrap>
      <Tooltip>
        <Content>Delete this instance of the playground</Content>
      </Tooltip>
    </TooltipTrigger>
  );
}
