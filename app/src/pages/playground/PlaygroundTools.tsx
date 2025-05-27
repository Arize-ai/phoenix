import { useMemo } from "react";

import { Form } from "@arizeai/components";

import {
  Counter,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  View,
} from "@phoenix/components";
import {
  isSupportedToolChoiceProvider,
  ToolChoiceSelector,
} from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundTool } from "./PlaygroundTool";
import { getToolName } from "./playgroundUtils";
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
    <Disclosure id="tools">
      <DisclosureTrigger arrowPosition="start">
        Tools
        <Counter>{tools.length}</Counter>
      </DisclosureTrigger>
      <DisclosurePanel>
        <View padding="size-200">
          <Flex direction="column">
            <Form>
              <ToolChoiceSelector
                provider={provider}
                choice={instance.toolChoice}
                onChange={(choice) => {
                  updateInstance({
                    instanceId,
                    patch: {
                      toolChoice: choice,
                    },
                    dirty: true,
                  });
                }}
                toolNames={toolNames}
              />
            </Form>
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
      </DisclosurePanel>
    </Disclosure>
  );
}
