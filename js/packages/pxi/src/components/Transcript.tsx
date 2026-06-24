import { TextAttributes } from "@opentui/core";

import type { AgentUIMessage } from "../chat/types";
import type { ChatStatus } from "../hooks/useServerAgentChat";
import { Message } from "./Message";

export type TranscriptProps = {
  messages: AgentUIMessage[];
  status: ChatStatus;
};

/**
 * Scrollable conversation transcript. Sticks to the bottom so new content stays
 * in view while streaming, but lets the user scroll up to read history.
 */
export function Transcript({ messages, status }: TranscriptProps) {
  const lastIndex = messages.length - 1;
  return (
    <scrollbox flexGrow={1} stickyScroll stickyStart="bottom" paddingRight={1}>
      {messages.length === 0 ? (
        <text fg="#565F89" attributes={TextAttributes.DIM}>
          Ask PXI anything about your Phoenix data…
        </text>
      ) : (
        messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            streaming={
              status === "streaming" &&
              index === lastIndex &&
              message.role === "assistant"
            }
          />
        ))
      )}
    </scrollbox>
  );
}
