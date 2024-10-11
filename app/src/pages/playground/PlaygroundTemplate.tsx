import React from "react";

import {
  Button,
  Card,
  Content,
  Flex,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { ModelConfigButton } from "./ModelConfigButton";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  const index = instances.findIndex((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { template } = instance;

  return (
    <Card
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={index} />
          <span>Prompt</span>
        </Flex>
      }
      collapsible
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex direction="row" gap="size-100">
          <ModelConfigButton {...props} />
          {instances.length > 1 ? <DeleteButton {...props} /> : null}
        </Flex>
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
