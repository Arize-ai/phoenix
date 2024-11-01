import React, { useCallback, useEffect, useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { Button, Card, Flex, Icon, Icons, Text } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { SpanKindIcon } from "@phoenix/components/trace";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolDefinitionJSONSchema,
  openAIToolDefinitionJSONSchema,
  openAIToolDefinitionSchema,
} from "@phoenix/schemas";
import { Tool } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { getToolName } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const TOOL_EDITOR_PRE_INIT_HEIGHT = 400;

export function PlaygroundTool({
  playgroundInstanceId,
  toolId,
}: PlaygroundInstanceProps & {
  toolId: Tool["id"];
}) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const instanceTools = instance.tools;

  const tool = instanceTools.find((t) => t.id === toolId);

  if (tool == null) {
    throw new Error(`Tool ${toolId} not found`);
  }

  const [editorValue, setEditorValue] = useState(
    JSON.stringify(tool.definition, null, 2)
  );

  const [lastValidDefinition, setLastValidDefinition] = useState(
    tool.definition
  );

  // Update editor when tool definition changes externally this can happen when switching between providers
  useEffect(() => {
    if (
      JSON.stringify(tool.definition) !== JSON.stringify(lastValidDefinition)
    ) {
      setLastValidDefinition(tool.definition);
      setEditorValue(JSON.stringify(tool.definition, null, 2));
    }
  }, [tool.definition, lastValidDefinition]);

  const onChange = useCallback(
    (value: string) => {
      setEditorValue(value);
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

      setLastValidDefinition(definition);

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

  const toolName = useMemo(() => {
    return getToolName(tool);
  }, [tool]);

  const toolDefinitionJSONSchema = useMemo((): JSONSchema7 => {
    switch (instance.model.provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return openAIToolDefinitionJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolDefinitionJSONSchema as JSONSchema7;
    }
  }, [instance.model.provider]);

  return (
    <Card
      collapsible
      backgroundColor={"yellow-100"}
      borderColor={"yellow-700"}
      variant="compact"
      title={
        <Flex direction="row" gap="size-100">
          <SpanKindIcon spanKind="tool" />
          <Text>{toolName ?? "Tool"}</Text>
        </Flex>
      }
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={editorValue} />
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
          value={editorValue}
          onChange={onChange}
          jsonSchema={toolDefinitionJSONSchema}
        />
      </LazyEditorWrapper>
    </Card>
  );
}
