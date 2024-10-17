import React, { useCallback, useState } from "react";
import { JSONSchema7 } from "json-schema";
import { css } from "@emotion/react";

import { Button, Dialog, Flex, Icon, Icons, View } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { toolJSONSchema, toolSchema } from "@phoenix/schemas";
import { Tool } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

/**
 * Determines whether the tool choice should be reset when the tool is deleted.
 * @param tool the tool being deleted
 * @param tools the set of tools in the instance
 * @param toolChoice the current tool choice
 * @returns whether the tool choice should be reset
 */
const getShouldResetToolChoice = ({
  toolChoice,
  tool,
  tools,
}: {
  tool: Tool;
  toolChoice?: ToolChoice;
  tools: Tool[];
}) => {
  if (toolChoice == null) {
    return false;
  }
  // If the tool being deleted is the only tool, or the tool being deleted is the chosen tool,
  // reset the tool choice, some LLM API's may throw if the tool choice is not valid
  const isOnlyTool = tools.length === 1;
  if (isOnlyTool) {
    return true;
  }
  if (typeof toolChoice === "string") {
    return false;
  }
  if (toolChoice.function.name === tool.definition.function.name) {
    return true;
  }
};

export function PlaygroundToolDialog({
  playgroundInstanceId,
  tool,
  instanceTools,
  instanceToolChoice,
  onClose,
}: PlaygroundInstanceProps & {
  tool: Tool;
  instanceTools: Tool[];
  instanceToolChoice?: ToolChoice;
  onClose: () => void;
}) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const [toolDefinition, setToolDefinition] = useState(
    JSON.stringify(tool.definition, null, 2)
  );

  const toolExists = instanceTools.some((t) => t.id === tool.id);

  const [toolParsingError, setToolParsingError] = useState<string | null>(null);

  const onSave = useCallback(() => {
    const { json: definition } = safelyParseJSON(toolDefinition);
    if (definition == null) {
      setToolParsingError("Invalid JSON");
      return;
    }
    // Don't use data here returned by safeParse, as we want to allow for extra keys,
    // there is no "deepPassthrough" to allow for extra keys
    // at all levels of the schema, so we just use the json parsed value here,
    // knowing that it is valid with potentially extra keys
    const { success } = toolSchema.safeParse(definition);
    if (!success) {
      setToolParsingError("Invalid tool definition");
      return;
    }
    updateInstance({
      instanceId: playgroundInstanceId,
      patch: {
        tools: !toolExists
          ? [...instanceTools, { ...tool, definition }]
          : instanceTools.map((t) =>
              t.id === tool.id
                ? {
                    ...t,
                    definition,
                  }
                : t
            ),
      },
    });
    onClose();
  }, [
    instanceTools,
    onClose,
    playgroundInstanceId,
    tool,
    toolDefinition,
    toolExists,
    updateInstance,
  ]);

  return (
    <Dialog
      title={toolExists ? "Edit Tool" : "Add Tool"}
      size="M"
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={toolDefinition} />
          {toolExists ? (
            <Button
              aria-label="Delete tool"
              icon={<Icon svg={<Icons.TrashOutline />} />}
              variant="default"
              size="compact"
              onClick={() => {
                const shouldResetToolChoice = getShouldResetToolChoice({
                  tool,
                  toolChoice: instanceToolChoice,
                  tools: instanceTools,
                });
                updateInstance({
                  instanceId: playgroundInstanceId,
                  patch: {
                    tools: instanceTools.filter((t) => t.id !== tool.id),
                    // If the tool being deleted is the only tool, or the tool being deleted is the chosen tool,
                    // reset the tool choice, some LLM API's may throw if the tool choice is not valid
                    toolChoice: shouldResetToolChoice
                      ? undefined
                      : instanceToolChoice,
                  },
                });
                onClose();
              }}
            />
          ) : null}
        </Flex>
      }
      css={css`
        padding: var(--ac-global-dimension-size-100);
      `}
    >
      <View padding="size-200">
        <CodeEditorFieldWrapper
          validationState={toolParsingError != null ? "invalid" : "valid"}
          errorMessage={toolParsingError}
        >
          <JSONEditor
            value={toolDefinition}
            onChange={(value) => {
              setToolDefinition(value);
              if (toolParsingError != null) {
                setToolParsingError(null);
              }
            }}
            jsonSchema={toolJSONSchema as JSONSchema7}
            onBlur={() => {
              const { json: parsedDefinition } =
                safelyParseJSON(toolDefinition);
              // If the JSON is valid, reformat it on blur
              if (parsedDefinition != null) {
                setToolDefinition(JSON.stringify(parsedDefinition, null, 2));
              }
            }}
          />
        </CodeEditorFieldWrapper>
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap={"size-100"}>
          <Button variant={"default"} onClick={onClose} size="compact">
            Cancel
          </Button>
          <Button variant={"primary"} size="compact" onClick={onSave}>
            Save
          </Button>
        </Flex>
      </View>
    </Dialog>
  );
}
