import type { JSONSchema7 } from "json-schema";
import { useCallback, useMemo } from "react";

import { JSONEditor } from "@phoenix/components/code";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolCallsJSONSchema,
  awsToolCallsJSONSchema,
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
  const store = usePlaygroundStore();
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
  const initialEditorValue = useMemo(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance != null) {
      const latestMessage = selectPlaygroundInstanceMessage(messageId)(state);
      if (latestMessage != null) {
        return JSON.stringify(latestMessage.toolCalls, null, 2);
      }
    }
    return JSON.stringify(toolCalls, null, 2);
  }, [messageId, playgroundInstanceId, store, toolCalls]);

  const onChange = useCallback(
    (value: string) => {
      const { json: toolCalls } = safelyParseJSON(value);

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
      case "DEEPSEEK":
      case "XAI":
      case "OLLAMA":
        return openAIToolCallsJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolCallsJSONSchema as JSONSchema7;
      case "AWS":
        return awsToolCallsJSONSchema as JSONSchema7;
      // TODO(apowell): #5348 Add Google tool calls schema
      case "GOOGLE":
        return null;
    }
  }, [instance.model.provider]);

  return (
    <JSONEditor
      value={initialEditorValue}
      jsonSchema={toolCallsJSONSchema}
      onChange={onChange}
    />
  );
}
