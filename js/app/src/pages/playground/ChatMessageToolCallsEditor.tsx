import type { JSONSchema7 } from "json-schema";
import { useCallback, useMemo, useState } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  anthropicToolCallsJSONSchema,
  awsToolCallsJSONSchema,
  openAIToolCallsJSONSchema,
} from "@phoenix/schemas/toolCallSchemas";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceMessage,
} from "@phoenix/store/playground/selectors";
import { assertUnreachable } from "@phoenix/typeUtils";
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
  const instanceProvider = instance.model.provider;
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
  const initialEditorValue = JSON.stringify(toolCalls, null, 2);

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
      case "CEREBRAS":
      case "FIREWORKS":
      case "GROQ":
      case "MOONSHOT":
      case "PERPLEXITY":
      case "TOGETHER":
        return openAIToolCallsJSONSchema as JSONSchema7;
      case "ANTHROPIC":
        return anthropicToolCallsJSONSchema as JSONSchema7;
      case "AWS":
        return awsToolCallsJSONSchema as JSONSchema7;
      // TODO(apowell): #5348 Add Google tool calls schema
      case "GOOGLE":
        return null;
      default:
        return assertUnreachable(instance.model.provider);
    }
  }, [instance.model.provider]);

  return (
    <UncontrolledToolCallsEditor
      key={instanceProvider}
      initialValue={initialEditorValue}
      jsonSchema={toolCallsJSONSchema}
      onChange={onChange}
    />
  );
}

function UncontrolledToolCallsEditor({
  initialValue,
  jsonSchema,
  onChange,
}: {
  initialValue: string;
  jsonSchema: JSONSchema7 | null;
  onChange: (value: string) => void;
}) {
  const [value] = useState(initialValue);
  return (
    <JSONEditor value={value} jsonSchema={jsonSchema} onChange={onChange} />
  );
}
