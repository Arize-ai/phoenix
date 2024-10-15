import React, { useMemo } from "react";

import { Card, Flex } from "@arizeai/components";

import { ToolChoicePicker } from "@phoenix/components/generative";
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
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  if (instance == null) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { tools } = instance;
  if (tools == null) {
    throw new Error(`Playground instance ${instanceId} does not have tools`);
  }
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );

  const toolNames = useMemo(
    () =>
      tools
        .map((tool) => tool.definition.function?.name)
        .filter((name) => name != null),
    [tools]
  );

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Tools" />}
      collapsible
      variant="compact"
    >
      <Flex direction="column" gap="size-100">
        <ToolChoicePicker
          choice={instance.toolChoice}
          onChange={(choice) => {
            updateInstance({
              instanceId,
              patch: {
                toolChoice: choice,
              },
            });
          }}
          toolNames={toolNames}
        />
        {tools.map((tool) => {
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
