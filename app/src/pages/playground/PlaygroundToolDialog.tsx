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

export function PlaygroundToolDialog({
  playgroundInstanceId,
  tool,
  instanceTools,
  onClose,
}: PlaygroundInstanceProps & {
  tool: Tool;
  instanceTools: Tool[];
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
                updateInstance({
                  instanceId: playgroundInstanceId,
                  patch: {
                    tools: instanceTools.filter((t) => t.id !== tool.id),
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
