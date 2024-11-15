import React, { useCallback, useEffect, useState } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ChatMessage } from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

const EMPTY_CONTENT: Array<unknown> = [];

/**
 * Editor for message content array
 */
export function ChatMessageJSONContentEditor({
  playgroundInstanceId,
  templateMessages,
  messageId,
}: {
  playgroundInstanceId: number;
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

  // Find the target message and get its content
  const message = templateMessages.find((m) => m.id === messageId);
  const content =
    typeof message?.content === "string"
      ? (safelyParseJSON(message.content).json ?? EMPTY_CONTENT)
      : (message?.content ?? EMPTY_CONTENT);

  const [editorValue, setEditorValue] = useState(() =>
    JSON.stringify(content, null, 2)
  );

  const [lastValidContent, setLastValidContent] = useState(content);

  // Update editor when content changes externally
  useEffect(() => {
    if (JSON.stringify(content) !== JSON.stringify(lastValidContent)) {
      setEditorValue(JSON.stringify(content, null, 2));
      setLastValidContent(content);
    }
  }, [lastValidContent, content]);

  const onChange = useCallback(
    (value: string) => {
      setEditorValue(value);
      const { json: parsedContent } = safelyParseJSON(value);
      if (parsedContent == null || !Array.isArray(parsedContent)) {
        return;
      }

      setLastValidContent(parsedContent);
      updateInstance({
        instanceId: playgroundInstanceId,
        patch: {
          template: {
            __type: "chat",
            messages: templateMessages.map((m) =>
              messageId === m.id
                ? {
                    ...m,
                    content: parsedContent,
                  }
                : m
            ),
          },
        },
      });
    },
    [messageId, playgroundInstanceId, templateMessages, updateInstance]
  );

  return <JSONEditor value={editorValue} onChange={onChange} />;
}
