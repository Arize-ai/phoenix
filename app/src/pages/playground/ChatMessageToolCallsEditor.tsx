import React, { useCallback, useEffect, useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { toolCallSchemas } from "@phoenix/schemas";
import {
  anthropicToolCallsJSONSchema,
  llmProviderToolCallSchema,
  llmProviderToolCallsSchema,
} from "@phoenix/schemas/toolCallSchemas";
import { ChatMessage } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

const { openAIToolCallsJSONSchema } = toolCallSchemas;

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
  const [editorValue, setEditorValue] = useState(() =>
    JSON.stringify(toolCalls, null, 2)
  );

  const [lastValidToolCalls, setLastValidToolCalls] = useState(toolCalls);

  // Update editor when tool calls changes externally, this can happen when switching between providers
  useEffect(() => {
    if (JSON.stringify(toolCalls) !== JSON.stringify(lastValidToolCalls)) {
      setEditorValue(JSON.stringify(toolCalls, null, 2));
      setLastValidToolCalls(toolCalls);
    }
  }, [lastValidToolCalls, toolCalls]);

  const onChange = useCallback(
    (value: string) => {
      setEditorValue(value);
      const { json: toolCalls } = safelyParseJSON(value);
      if (toolCalls == null) {
        return;
      }
      // Don't use data here returned by safeParse, as we want to allow for extra keys,
      // there is no "deepPassthrough" to allow for extra keys
      // at all levels of the schema, so we just use the json parsed value here,
      // knowing that it is valid with potentially extra keys
      const { success } = llmProviderToolCallsSchema.safeParse(toolCalls);
      if (!success) {
        return;
      }
      setLastValidToolCalls(toolCalls);
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          template: {
            __type: "chat",
            messages: templateMessages.map((m) =>
              messageId === m.id
                ? {
                    ...m,
                    toolCalls,
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
      value={editorValue}
      jsonSchema={toolCallsJSONSchema}
      onChange={onChange}
    />
  );
}
