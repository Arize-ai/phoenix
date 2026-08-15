import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessage } from "./LLMMessage";
import { useLLMMessagesCollapse } from "./LLMMessagesCollapseContext";

/**
 * A list of LLM messages (input or output).
 */
export function LLMMessagesList({
  messages,
  leadingItems,
}: {
  messages: AttributeMessage[];
  /**
   * Extra content rendered as list items above the messages (e.g. collapsed
   * prompt template / invocation params cards on the input side).
   */
  leadingItems?: ReactNode[];
}) {
  const { isMessageOpen, setMessageOpen } = useLLMMessagesCollapse();
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-200);
      `}
    >
      {leadingItems?.map((item, idx) => (
        <li key={`leading-${idx}`}>{item}</li>
      ))}
      {messages.map((message, idx) => {
        return (
          <li key={idx}>
            <LLMMessage
              message={message}
              isOpen={isMessageOpen(idx)}
              onOpenChange={(isOpen) => setMessageOpen(idx, isOpen)}
            />
          </li>
        );
      })}
    </ul>
  );
}
