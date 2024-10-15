import React from "react";

import { Card, Flex } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundTool } from "./PlaygroundTool";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundToolsProps extends PlaygroundInstanceProps {}

export function PlaygroundTools(props: PlaygroundToolsProps) {
  const instanceId = props.playgroundInstanceId;
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );
  if (instance == null) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  if (instance.tools == null) {
    throw new Error(`Playground instance ${instanceId} does not have tools`);
  }
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Tools" />}
      collapsible
      variant="compact"
    >
      <Flex direction="column" gap="size-50">
        {instance.tools.map((tool) => {
          return (
            <PlaygroundTool
              key={tool.id}
              playgroundInstanceId={instanceId}
              tool={tool}
              instanceTools={instance.tools}
            />
          );
        })}
      </Flex>
    </Card>
  );
}
