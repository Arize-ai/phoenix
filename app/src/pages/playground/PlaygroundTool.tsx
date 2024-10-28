import React, { useCallback, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { Button, Card, Flex, Icon, Icons, Text } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { SpanKindIcon } from "@phoenix/components/trace";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  openAIToolDefinitionJSONSchema,
  openAIToolDefinitionSchema,
} from "@phoenix/schemas";
import { OpenAITool } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const TOOL_EDITOR_PRE_INIT_HEIGHT = 400;

export function PlaygroundTool({
  playgroundInstanceId,
  tool,
  instanceTools,
}: PlaygroundInstanceProps & {
  tool: OpenAITool;
  instanceTools: OpenAITool[];
}) {
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
      // Don't use data here returned by safeParse, as we want to allow for extra keys,
      // there is no "deepPassthrough" to allow for extra keys
      // at all levels of the schema, so we just use the json parsed value here,
      // knowing that it is valid with potentially extra keys
      const { success } = openAIToolDefinitionSchema.safeParse(definition);
      if (!success) {
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
      backgroundColor={"yellow-100"}
      borderColor={"yellow-700"}
      variant="compact"
      title={
        <Flex direction="row" gap="size-100">
          <SpanKindIcon spanKind="tool" />
          <Text>{tool.definition.function?.name ?? "Tool"}</Text>
        </Flex>
      }
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={toolDefinition} />
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
                  toolChoice: undefined,
                },
              });
            }}
          />
        </Flex>
      }
    >
      <LazyEditorWrapper
        preInitializationMinHeight={TOOL_EDITOR_PRE_INIT_HEIGHT}
      >
        <JSONEditor
          value={toolDefinition}
          onChange={onChange}
          jsonSchema={openAIToolDefinitionJSONSchema as JSONSchema7}
        />
      </LazyEditorWrapper>
    </Card>
  );
}
