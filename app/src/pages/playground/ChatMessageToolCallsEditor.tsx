import React, { useCallback, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  openAIToolCallsJSONSchema,
  openAIToolCallsSchema,
} from "@phoenix/schemas";
import { ChatMessage } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PlaygroundInstanceProps } from "./types";

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

  return (
    <JSONEditor
      value={toolCallsValue}
      jsonSchema={openAIToolCallsJSONSchema as JSONSchema7}
      onChange={onChange}
    />
  );
}
