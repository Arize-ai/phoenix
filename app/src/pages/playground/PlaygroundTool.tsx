import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { Card } from "@arizeai/components";

import {
  Button,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { SpanKindIcon } from "@phoenix/components/trace";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolDefinitionJSONSchema,
  openAIToolDefinitionJSONSchema,
} from "@phoenix/schemas";
import { findToolChoiceName } from "@phoenix/schemas/toolChoiceSchemas";
import { Tool } from "@phoenix/store";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { getToolName } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const TOOL_EDITOR_PRE_INIT_HEIGHT = 400;

/**
 * A tool editor that is used to edit the definition of a tool.
 *
 * This is a mostly un-controlled editor that re-mounts when the tool definition changes externally.
 * This is necessary because controlled react-codemirror editors incessantly remount and reset
 * cursor position when value is updated.
 */
export function PlaygroundTool({
  playgroundInstanceId,
  toolId,
}: PlaygroundInstanceProps & {
  toolId: Tool["id"];
}) {
  const store = usePlaygroundStore();
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const instanceProvider = instance.model.provider;
  const instanceTools = instance.tools;
  const tool = instanceTools.find((t) => t.id === toolId);

  if (tool == null) {
    throw new Error(`Tool ${toolId} not found`);
  }

  const [initialEditorValue, setInitialEditorValue] = useState(() =>
    JSON.stringify(tool.definition, null, 2)
  );
  const editorValueRef = useRef(initialEditorValue);

  // when the instance provider changes, we need to update the editor value
  // to reflect the new tool definition schema
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const tool = instance.tools.find((t) => t.id === toolId);
    if (tool == null) {
      return;
    }
    const newDefinition = JSON.stringify(tool.definition, null, 2);
    if (isJSONString({ str: newDefinition, excludeNull: true })) {
      setInitialEditorValue(newDefinition);
    }
  }, [instanceProvider, store, playgroundInstanceId, toolId]);

  const onChange = useCallback(
    (value: string) => {
      editorValueRef.current = value;
      const { json: definition } = safelyParseJSON(value);
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
        dirty: true,
      });
    },
    [instanceTools, playgroundInstanceId, tool.id, updateInstance]
  );

  const toolName = useMemo(() => {
    return getToolName(tool);
  }, [tool]);

  const toolDefinitionJSONSchema = useMemo((): JSONSchema7 | null => {
    switch (instance.model.provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return openAIToolDefinitionJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolDefinitionJSONSchema as JSONSchema7;
      case "GOOGLE":
        return null;
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
          <CopyToClipboardButton text={editorValueRef} />
          <Button
            aria-label="Delete tool"
            leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
            size="S"
            onPress={() => {
              const newTools = instanceTools.filter((t) => t.id !== tool.id);
              const deletingToolChoice =
                typeof instance.toolChoice === "object" &&
                toolName != null &&
                findToolChoiceName(instance.toolChoice) === toolName;

              let toolChoice = instance.toolChoice;
              if (newTools.length === 0) {
                toolChoice = undefined;
              } else if (deletingToolChoice) {
                toolChoice = "auto";
              }
              updateInstance({
                instanceId: playgroundInstanceId,
                patch: {
                  tools: newTools,
                  toolChoice,
                },
                dirty: true,
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
          value={initialEditorValue}
          onChange={onChange}
          jsonSchema={toolDefinitionJSONSchema}
        />
      </LazyEditorWrapper>
    </Card>
  );
}
