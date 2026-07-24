import { css } from "@emotion/react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessage } from "./LLMMessage";

/**
 * A list of LLM messages (input or output).
 */
export function LLMMessagesList({
  messages,
}: {
  messages: AttributeMessage[];
}) {
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-200);
      `}
    >
      {messages.map((message, idx) => {
        return (
          <li key={idx}>
            <LLMMessage message={message} />
          </li>
        );
      })}
    </ul>
  );
}
