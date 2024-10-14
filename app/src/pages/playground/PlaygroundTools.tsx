import React from "react";

import { Button, Card, Flex, Icon, Icons } from "@arizeai/components";

import { JSONToolEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

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
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
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
        {instance.tools.map((tool) => (
          <Card
            collapsible
            variant="compact"
            key={tool.id}
            title={tool.definition.function.name}
            bodyStyle={{ padding: 0 }}
            extra={
              <Button
                aria-label="Delete tool"
                icon={<Icon svg={<Icons.TrashOutline />} />}
                variant="default"
                size="compact"
                onClick={() => {
                  updateInstance({
                    instanceId,
                    patch: {
                      tools: instance.tools.filter((t) => t.id !== tool.id),
                    },
                  });
                }}
              />
            }
          >
            <JSONToolEditor
              value={JSON.stringify(tool.definition, null, 2)}
              onChange={(value) => {
                updateInstance({
                  instanceId,
                  patch: {
                    tools: instance.tools.map((t) =>
                      t.id === tool.id
                        ? {
                            ...t,
                            definition: JSON.parse(value),
                          }
                        : t
                    ),
                  },
                });
              }}
            />
          </Card>
        ))}
      </Flex>
    </Card>
  );
}
