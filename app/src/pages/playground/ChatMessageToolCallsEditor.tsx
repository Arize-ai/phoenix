import React, { useCallback, useEffect, useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolCallsJSONSchema,
  llmProviderToolCallsSchema,
  openAIToolCallsJSONSchema,
} from "@phoenix/schemas/toolCallSchemas";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceMessage,
} from "@phoenix/store/playground/selectors";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/**
 * Editor for message tool calls
 */
export function ChatMessageToolCallsEditor({
  playgroundInstanceId,
  messageId,
}: {
  playgroundInstanceId: number;
  messageId: number;
}) {
  const instanceSelector = useMemo(
    () => selectPlaygroundInstance(playgroundInstanceId),
    [playgroundInstanceId]
  );
  const instance = usePlaygroundContext(instanceSelector);
  if (instance == null) {
    throw new Error(`Instance ${playgroundInstanceId} not found`);
  }
  const messageSelector = useMemo(
    () => selectPlaygroundInstanceMessage(messageId),
    [messageId]
  );
  const message = usePlaygroundContext(messageSelector);
  if (message == null) {
    throw new Error(`Message ${messageId} not found`);
  }
  const toolCalls = message.toolCalls;
  const updateMessage = usePlaygroundContext((state) => state.updateMessage);
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
      updateMessage({
        instanceId: playgroundInstanceId,
        messageId,
        patch: {
          toolCalls,
        },
      });
    },
    [playgroundInstanceId, messageId, updateMessage]
  );

  const toolCallsJSONSchema = useMemo((): JSONSchema7 | null => {
    switch (instance.model.provider) {
      case "OPENAI":
      case "AZURE_OPENAI":
        return openAIToolCallsJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolCallsJSONSchema as JSONSchema7;
      // TODO(apowell): #5348 Add Gemini tool calls schema
      case "GEMINI":
        return null;
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
