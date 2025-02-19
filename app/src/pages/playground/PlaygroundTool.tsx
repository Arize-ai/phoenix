import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolDefinitionJSONSchema,
  llmProviderToolDefinitionSchema,
  openAIToolDefinitionJSONSchema,
} from "@phoenix/schemas";
import { findToolChoiceName } from "@phoenix/schemas/toolChoiceSchemas";
import { Tool } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

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
  const [version, setVersion] = useState(0);
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

  const [initialEditorValue, setEditorValue] = useState(
    JSON.stringify(tool.definition, null, 2)
  );

  // track the current value of the editor, even when it is invalid
  const currentValueRef = useRef(initialEditorValue);

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
      setVersion((prev) => prev + 1);
    }
  }, [tool.definition, lastValidDefinition]);

  const onChange = useCallback(
    (value: string) => {
      // track the current value of the editor, even when it is invalid
      currentValueRef.current = value;
      // note that we do not update initialEditorValue here, we only want to update it when
      // we are okay with the editor state resetting, which is basically only when the provider
      // changes
      const { json: definition } = safelyParseJSON(value);
      if (definition == null) {
        return;
      }
      // Don't use data here returned by safeParse, as we want to allow for extra keys,
      // there is no "deepPassthrough" to allow for extra keys
      // at all levels of the schema, so we just use the json parsed value here,
      // knowing that it is valid with potentially extra keys
      const { success } = llmProviderToolDefinitionSchema.safeParse(definition);
      if (!success) {
        return;
      }

      // @todo: Reconsider this approach, as it may lead to a situation where the editor
      // reflects one definition while what gets saved is another (the last valid one).
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
          <CopyToClipboardButton text={currentValueRef} />
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
          // force remount of the editor when the tool definition changes externally
          // usually when switching between providers
          key={version}
          value={initialEditorValue}
          onChange={onChange}
          jsonSchema={toolDefinitionJSONSchema}
        />
      </LazyEditorWrapper>
    </Card>
  );
}
