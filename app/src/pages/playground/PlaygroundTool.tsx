import type { JSONSchema7 } from "json-schema";
import { useCallback, useMemo } from "react";

import {
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { JSONToolEditor } from "@phoenix/pages/playground/PlaygroundToolType/JSONToolEditor";
import type { Tool } from "@phoenix/store";

import {
  getToolDefinitionDisplay,
  getToolName,
  isFunctionTool,
  toolFromEditorJSON,
} from "./playgroundUtils";
import type { PlaygroundInstanceProps } from "./types";

export type UpdateToolFn = (definition: unknown) => void;

export type BaseToolEditorProps = {
  playgroundInstanceId: number;
  tool: Tool;
  /** Canonical definition converted to the current provider's display format. */
  displayDefinition: unknown;
  updateTool: UpdateToolFn;
  toolDefinitionJSONSchema: JSONSchema7 | null;
};

const ToolEditor = (props: BaseToolEditorProps) => {
  switch (props.tool.editorType) {
    // TODO: add support for other tool types
    case "json":
    default:
      return <JSONToolEditor {...props} />;
  }
};

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
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }

  const toolChoice = instance.toolChoice;
  const instanceTools = instance.tools;
  const tool = instanceTools.find((t) => t.id === toolId);

  if (tool == null) {
    throw new Error(`Tool ${toolId} not found`);
  }

  const toolName = useMemo(() => {
    return getToolName(tool);
  }, [tool]);

  const updateTool = useCallback(
    (value: unknown) => {
      const nextTool = toolFromEditorJSON({
        value,
        id: tool.id,
        editorType: tool.editorType,
      });
      if (nextTool == null) return;
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          tools: instanceTools.map((t) => (t.id === tool.id ? nextTool : t)),
        },
        dirty: true,
      });
    },
    [instanceTools, playgroundInstanceId, tool, updateInstance]
  );

  const deleteTool = useCallback(() => {
    const newTools = instanceTools.filter((t) => t.id !== toolId);
    const deletedFunctionToolName = isFunctionTool(tool)
      ? (tool.definition?.name ?? null)
      : null;
    const deletingToolChoice =
      toolChoice?.type === "SPECIFIC_FUNCTION" &&
      deletedFunctionToolName != null &&
      toolChoice.functionName === deletedFunctionToolName;
    let newToolChoice = toolChoice;
    if (newTools.length === 0) {
      newToolChoice = undefined;
    } else if (deletingToolChoice) {
      newToolChoice = { type: "ZERO_OR_MORE" };
    }
    updateInstance({
      instanceId: playgroundInstanceId,
      patch: {
        tools: newTools,
        toolChoice: newToolChoice,
      },
      dirty: true,
    });
  }, [
    instanceTools,
    playgroundInstanceId,
    tool,
    toolId,
    toolChoice,
    updateInstance,
  ]);

  const toolDefinitionDisplay = useMemo(() => {
    return tool.kind === "raw"
      ? tool.raw
      : getToolDefinitionDisplay(tool.definition, instance.model.provider);
  }, [tool, instance.model.provider]);

  const toolDefinitionString = useMemo(() => {
    return JSON.stringify(toolDefinitionDisplay, null, 2);
  }, [toolDefinitionDisplay]);

  return (
    <Card
      collapsible
      backgroundColor={"yellow-100"}
      borderColor={"yellow-700"}
      title={
        <Flex direction="row" gap="size-100">
          <SpanKindIcon spanKind="tool" />
          <Text>{toolName ?? "Tool"}</Text>
        </Flex>
      }
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={toolDefinitionString} />
          <Button
            aria-label="Delete tool"
            leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
            size="S"
            onPress={deleteTool}
          />
        </Flex>
      }
    >
      <ToolEditor
        playgroundInstanceId={playgroundInstanceId}
        tool={tool}
        displayDefinition={toolDefinitionDisplay}
        updateTool={updateTool}
        toolDefinitionJSONSchema={null}
      />
    </Card>
  );
}
