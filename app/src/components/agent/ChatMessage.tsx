import { css } from "@emotion/react";
import { isTextUIPart } from "ai";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  Message,
  MessageActions,
  MessageContent,
  MessageToolbar,
} from "@phoenix/components/ai/message";
import { MarkdownBlock } from "@phoenix/components/markdown";

import { AssistantMessageActions } from "./AssistantMessageActions";
import { GenerativeUI } from "./generativeUI";
import { groupMessageParts } from "./groupMessageParts";
import { MessageRewindActions } from "./MessageRewindActions";
import type {
  MessageRewindMode,
  MessageRewindRole,
} from "./MessageRewindDialog";
import { ToolPart } from "./ToolPart";
import { ToolPartGroup } from "./ToolPartGroup";

/**
 * Reports a rewind/fork request from a message's controls up to the chat view,
 * which owns the single confirmation dialog. Optional so messages can render
 * without the controls (e.g. while streaming) by omitting the prop entirely.
 */
export type MessageRewindRequest = (request: {
  mode: MessageRewindMode;
  messageId: string;
  role: MessageRewindRole;
}) => void;

const assistantMessageCSS = css`
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Renders a user message bubble (right-aligned, primary colour). When
 * `rewindHandlers` is provided a rewind/fork toolbar is shown below the bubble.
 */
export function UserMessage({
  message,
  onRewindRequest,
}: {
  message: AgentUIMessage;
  onRewindRequest?: MessageRewindRequest;
}) {
  const text = message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");

  return (
    <Message from="user">
      <MessageContent>{text}</MessageContent>
      {onRewindRequest ? (
        <MessageToolbar>
          <MessageActions>
            <MessageRewindActions
              messageId={message.id}
              role="user"
              onRequest={onRewindRequest}
            />
          </MessageActions>
        </MessageToolbar>
      ) : null}
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
 *
 * `pinToolbar` keeps the toolbar always visible instead of revealing it on
 * hover/focus. Callers use it for the most recent assistant turn, whose actions
 * (copy, feedback, trace) are the ones users reach for most often.
 */
export function AssistantMessage({
  message,
  showActions = true,
  pinToolbar = false,
  onRewindRequest,
}: {
  message: AgentUIMessage;
  showActions?: boolean;
  pinToolbar?: boolean;
  onRewindRequest?: MessageRewindRequest;
}) {
  const grouped = groupMessageParts(message.parts);

  return (
    <Message from="assistant" data-pin-toolbar={pinToolbar || undefined}>
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
              case "generative-ui":
                return (
                  <GenerativeUI
                    key={`generative-ui-${group.index}`}
                    parts={[group.part]}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      </MessageContent>
      {showActions ? (
        <AssistantMessageActions message={message}>
          {onRewindRequest ? (
            <MessageRewindActions
              messageId={message.id}
              role="assistant"
              onRequest={onRewindRequest}
            />
          ) : null}
        </AssistantMessageActions>
      ) : null}
    </Message>
  );
}
