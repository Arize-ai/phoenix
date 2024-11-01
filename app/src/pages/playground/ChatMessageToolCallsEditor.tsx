import React, { useCallback, useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { toolCallSchemas } from "@phoenix/schemas";
import { anthropicToolCallsJSONSchema } from "@phoenix/schemas/toolCallSchemas";
import { ChatMessage } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

const { openAIToolCallsSchema, openAIToolCallsJSONSchema } = toolCallSchemas;

/**
 * Editor for message tool calls
 */
export function ChatMessageToolCallsEditor({
  playgroundInstanceId,
  toolCalls,
  templateMessages,
  messageId,
}: PlaygroundInstanceProps & {
  toolCalls: ChatMessage["toolCalls"];
  templateMessages: ChatMessage[];
  messageId: number;
}) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }
  const [toolCallsValue, setToolCallsValue] = useState(() =>
    JSON.stringify(toolCalls, null, 2)
  );

  const onChange = useCallback(
    (value: string) => {
      setToolCallsValue(value);
      const { json: definition } = safelyParseJSON(value);
      if (definition == null) {
        return;
      }
      // Don't use data here returned by safeParse, as we want to allow for extra keys,
      // there is no "deepPassthrough" to allow for extra keys
      // at all levels of the schema, so we just use the json parsed value here,
      // knowing that it is valid with potentially extra keys
      const { success } = openAIToolCallsSchema.safeParse(definition);
      if (!success) {
        return;
      }
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          template: {
            __type: "chat",
            messages: templateMessages.map((m) =>
              messageId === m.id
                ? {
                    ...m,
                    toolCalls: definition,
                  }
                : m
            ),
          },
        },
      });
    },
    [messageId, playgroundInstanceId, templateMessages, updateInstance]
  );

  const toolCallsJSONSchema = useMemo((): JSONSchema7 => {
    switch (instance.model.provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return openAIToolCallsJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolCallsJSONSchema as JSONSchema7;
    }
  }, [instance.model.provider]);

  return (
    <JSONEditor
      value={toolCallsValue}
      jsonSchema={toolCallsJSONSchema}
      onChange={onChange}
    />
  );
}
