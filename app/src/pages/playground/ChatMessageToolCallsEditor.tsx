import { useCallback, useEffect, useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { JSONEditor } from "@phoenix/components/code";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolCallsJSONSchema,
  openAIToolCallsJSONSchema,
} from "@phoenix/schemas/toolCallSchemas";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceMessage,
} from "@phoenix/store/playground/selectors";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

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
  const instanceProvider = instance.model.provider;
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
  const [initialEditorValue, setInitialEditorValue] = useState(() =>
    JSON.stringify(toolCalls, null, 2)
  );

  // when the instance provider changes, we need to update the editor value
  // to reflect the new tool calls schema
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const message = selectPlaygroundInstanceMessage(messageId)(state);
    if (message == null) {
      return;
    }
    const newToolCalls = message.toolCalls;
    const newEditorValue = JSON.stringify(newToolCalls, null, 2);
    if (isJSONString({ str: newEditorValue, excludeNull: true })) {
      setInitialEditorValue(newEditorValue);
    }
  }, [instanceProvider, store, playgroundInstanceId, messageId]);

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
        return openAIToolCallsJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolCallsJSONSchema as JSONSchema7;
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
