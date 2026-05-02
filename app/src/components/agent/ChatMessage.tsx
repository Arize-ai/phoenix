import { css } from "@emotion/react";
import { isTextUIPart } from "ai";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { Message, MessageContent } from "@phoenix/components/ai/message";
import { MarkdownBlock } from "@phoenix/components/markdown";

import { AssistantMessageActions } from "./AssistantMessageActions";
import { groupMessageParts } from "./groupMessageParts";
import { ToolPart } from "./ToolPart";
import { ToolPartGroup } from "./ToolPartGroup";

const assistantMessageCSS = css`
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Renders a user message bubble (right-aligned, primary colour). */
export function UserMessage({ parts }: { parts: AgentUIMessage["parts"] }) {
  const text = parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");

  return (
    <Message from="user">
      <MessageContent>{text}</MessageContent>
    </Message>
  );
}

/**
 * Renders an assistant message consisting of interleaved text and tool-call
 * parts. Consecutive runs of 3+ tool calls are collapsed into a
 * {@link ToolPartGroup} pool; shorter runs render individually as
 * {@link ToolPart} details.
 *
 * `showActions` gates the feedback/copy/trace toolbar — callers should set
 * it to `false` while this particular message is still streaming so users
 * don't interact with incomplete content.
 */
export function AssistantMessage({
  message,
  showActions = true,
}: {
  message: AgentUIMessage;
  showActions?: boolean;
}) {
  const grouped = groupMessageParts(message.parts);

  return (
    <Message from="assistant">
      <MessageContent>
        <div css={assistantMessageCSS}>
          {grouped.map((group) => {
            switch (group.kind) {
              case "text":
                return (
                  <MarkdownBlock
                    key={`text-${group.index}`}
                    mode="markdown"
                    renderMode="streaming"
                    margin="none"
                  >
                    {group.part.type === "text" ? group.part.text : ""}
                  </MarkdownBlock>
                );
              case "tool-solo":
                return (
                  <ToolPart key={`tool-${group.index}`} part={group.part} />
                );
              case "tool-group":
                return (
                  <ToolPartGroup
                    key={`pool-${group.startIndex}`}
                    parts={group.parts}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      </MessageContent>
      {showActions ? <AssistantMessageActions message={message} /> : null}
    </Message>
  );
}
