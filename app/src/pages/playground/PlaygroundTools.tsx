import { useMemo } from "react";

import { Card, Counter, Flex, View } from "@phoenix/components";
import {
  isSupportedToolChoiceProvider,
  ToolChoiceSelector,
} from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundTool } from "./PlaygroundTool";
import { getToolName } from "./playgroundUtils";
import type { PlaygroundInstanceProps } from "./types";

interface PlaygroundToolsProps extends PlaygroundInstanceProps {}

export function PlaygroundTools(props: PlaygroundToolsProps) {
  const instanceId = props.playgroundInstanceId;
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );
  const setInstanceTools = usePlaygroundContext(
    (state) => state.setInstanceTools
  );
  const setDirty = usePlaygroundContext((state) => state.setDirty);
  if (instance == null) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { tools } = instance;
  if (tools == null) {
    throw new Error(`Playground instance ${instanceId} does not have tools`);
  }

  const toolNames = useMemo(
    () =>
      tools
        .map((tool) => getToolName(tool))
        .filter((name): name is NonNullable<typeof name> => name != null),
    [tools]
  );

  const provider = instance.model.provider;

  if (!isSupportedToolChoiceProvider(provider)) {
    return null;
  }

  return (
    <Card
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          Tools
          <Counter>{tools.length}</Counter>
        </Flex>
      }
      collapsible
    >
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <ToolChoiceSelector
            provider={provider}
            choice={instance.toolChoice}
            onChange={(choice) => {
              setInstanceTools(instanceId, tools, choice);
              setDirty(instanceId, true);
            }}
            toolNames={toolNames}
          />
          <Flex direction={"column"} gap="size-200">
            {tools.map((tool) => {
              return (
                <PlaygroundTool
                  key={tool.id}
                  playgroundInstanceId={instanceId}
                  toolId={tool.id}
                />
              );
            })}
          </Flex>
        </Flex>
      </View>
    </Card>
  );
}
