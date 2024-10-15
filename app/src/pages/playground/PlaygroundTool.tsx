import React, { useCallback, useState } from "react";

import { Button, Card, Icon, Icons } from "@arizeai/components";

import { JSONToolEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Tool } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

export function PlaygroundTool({
  playgroundInstanceId,
  tool,
  instanceTools,
}: PlaygroundInstanceProps & { tool: Tool; instanceTools: Tool[] }) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const [toolDefinition, setToolDefinition] = useState(
    JSON.stringify(tool.definition, null, 2)
  );

  const onChange = useCallback(
    (value: string) => {
      setToolDefinition(value);
      const { json: definition } = safelyParseJSON(value);
      if (definition == null) {
        return;
      }
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          tools: instanceTools.map((t) =>
            t.id === tool.id
              ? {
                  ...t,
                  definition,
                }
              : t
          ),
        },
      });
    },
    [instanceTools, playgroundInstanceId, tool.id, updateInstance]
  );

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
      <JSONToolEditor value={toolDefinition} onChange={onChange} />
    </Card>
  );
}
