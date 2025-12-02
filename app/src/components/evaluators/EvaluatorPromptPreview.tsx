/**
 * A component that shows a preview of the prompt that will be used for the llm evals
 **/

import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Card, Flex } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { ChatMessage } from "@phoenix/store/playground/types";

export function EvaluatorPromptPreview() {
  const template = usePlaygroundContext((state) => {
    const instance = state.instances[0];
    return instance.template;
  });
  const messages = usePlaygroundContext((state) => state.allInstanceMessages);
  invariant(template.__type === "chat", "Template must be a chat template");
  return (
    <Flex direction="column" gap="size-200">
      {template.messageIds.map((messageId) => {
        const message = messages[messageId];
        return <MessageCard message={message} key={messageId} />;
      })}
    </Flex>
  );
}

function MessageCard({ message }: { message: ChatMessage }) {
  const styles = useChatMessageStyles(message.role);
  return (
    <Card title={message.role} key={message.id} {...styles}>
      <pre
        key={message.id}
        css={css`
          white-space: pre-wrap;
          padding-left: var(--ac-global-dimension-static-size-200);
          padding-right: var(--ac-global-dimension-static-size-200);
        `}
      >
        {message.content}
      </pre>
    </Card>
  );
}
