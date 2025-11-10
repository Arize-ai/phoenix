import { useCallback, useMemo } from "react";
import { JSONSchema7 } from "json-schema";

import {
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { CategoricalChoiceTool } from "@phoenix/pages/playground/PlaygroundToolType/CategoricalChoiceTool";
import { JSONTool } from "@phoenix/pages/playground/PlaygroundToolType/JSONTool";
import {
  anthropicToolDefinitionJSONSchema,
  awsToolDefinitionJSONSchema,
  openAIToolDefinitionJSONSchema,
} from "@phoenix/schemas";
import { PhoenixToolTypeTypeSchema } from "@phoenix/schemas/phoenixToolTypeSchemas";
import { findToolChoiceName } from "@phoenix/schemas/toolChoiceSchemas";
import { Tool } from "@phoenix/store";

import { getToolName } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

export type UpdateToolFn = (definition: Tool["definition"]) => void;

export type BaseToolEditorProps = {
  playgroundInstanceId: number;
  tool: Tool;
  updateTool: UpdateToolFn;
  toolDefinitionJSONSchema: JSONSchema7 | null;
};

const ToolEditor = (props: BaseToolEditorProps) => {
  switch (props.tool.type) {
    case "categorical_choice":
      return <CategoricalChoiceTool {...props} />;
    case "json":
    default:
      return <JSONTool {...props} />;
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
  const instanceProvider = instance.model.provider;
  const instanceTools = instance.tools;
  const tool = instanceTools.find((t) => t.id === toolId);

  if (tool == null) {
    throw new Error(`Tool ${toolId} not found`);
  }

  const toolDefinition = tool.definition;

  const toolName = useMemo(() => {
    return getToolName(tool);
  }, [tool]);

  const updateTool = useCallback(
    (definition: Tool["definition"]) => {
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

  const deleteTool = useCallback(() => {
    const newTools = instanceTools.filter((t) => t.id !== toolId);
    const deletingToolChoice =
      typeof toolChoice === "object" &&
      toolName != null &&
      findToolChoiceName(toolChoice) === toolName;
    let newToolChoice = toolChoice;
    if (newTools.length === 0) {
      newToolChoice = undefined;
    } else if (deletingToolChoice) {
      newToolChoice = "auto";
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
    toolId,
    toolChoice,
    toolName,
    updateInstance,
  ]);

  const changeToolType = useCallback(
    (maybeType: unknown) => {
      const type = PhoenixToolTypeTypeSchema.safeParse(maybeType);
      if (!type.success) {
        return;
      }
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          tools: instanceTools.map((t) =>
            t.id === toolId ? { ...t, type: type.data } : t
          ),
        },
        dirty: true,
      });
    },
    [instanceTools, playgroundInstanceId, toolId, updateInstance]
  );

  const toolDefinitionString = useMemo(() => {
    return JSON.stringify(toolDefinition, null, 2);
  }, [toolDefinition]);

  const toolDefinitionJSONSchema = useMemo((): JSONSchema7 | null => {
    switch (instanceProvider) {
      case "OPENAI":
      case "AZURE_OPENAI":
      case "DEEPSEEK":
      case "XAI":
      case "OLLAMA":
        return openAIToolDefinitionJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolDefinitionJSONSchema as JSONSchema7;
      case "AWS":
        return awsToolDefinitionJSONSchema as JSONSchema7;
      case "GOOGLE":
        return null;
    }
  }, [instanceProvider]);

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
          <Select size="S" value={tool.type} onChange={changeToolType}>
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox>
                <SelectItem id="json">JSON</SelectItem>
                <SelectItem id="categorical_choice">
                  Categorical Choice
                </SelectItem>
              </ListBox>
            </Popover>
          </Select>
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
        updateTool={updateTool}
        toolDefinitionJSONSchema={toolDefinitionJSONSchema}
      />
    </Card>
  );
}
