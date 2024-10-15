import React from "react";

import { Button, Card, Icon, Icons } from "@arizeai/components";

import { JSONToolEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Tool } from "@phoenix/store";

import { PlaygroundInstanceProps } from "./types";

export function PlaygroundTool({
  playgroundInstanceId,
  tool,
  instanceTools,
}: PlaygroundInstanceProps & { tool: Tool; instanceTools: Tool[] }) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  return (
    <Card
      collapsible
      variant="compact"
      key={tool.id}
      title={tool.definition.function?.name ?? "Tool"}
      bodyStyle={{ padding: 0 }}
      extra={
        <Button
          aria-label="Delete tool"
          icon={<Icon svg={<Icons.TrashOutline />} />}
          variant="default"
          size="compact"
          onClick={() => {
            updateInstance({
              instanceId: playgroundInstanceId,
              patch: {
                tools: instanceTools.filter((t) => t.id !== tool.id),
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
            instanceId: playgroundInstanceId,
            patch: {
              tools: instanceTools.map((t) =>
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
  );
}
