import { css } from "@emotion/react";
import { isTextUIPart } from "ai";

import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import {
  Message,
  MessageActions,
  MessageContent,
  MessageCopyAction,
  MessageToolbar,
} from "@phoenix/components/ai/message";
import { MarkdownBlock } from "@phoenix/components/markdown";

import { AssistantMessageActions } from "./AssistantMessageActions";
import { GenerativeUI } from "./generativeUI";
import { MessageRewindActions } from "./MessageRewindActions";
import type {
  MessageRewindMode,
  MessageRewindRole,
} from "./MessageRewindDialog";
import { partitionMessageParts } from "./partitionMessageParts";
import { ToolPart } from "./ToolPart";

/**
 * Reports a rewind/branch request from a message's controls up to the chat view,
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

  /* Mirrors the chat's compaction-divider treatment so turn-level notices
     share one visual language, in the warning palette the interrupted
     recovery notice already uses. */
  .assistant-message__interrupted {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    width: 100%;
    margin: var(--global-dimension-size-100) 0;
    color: var(--global-color-warning-700);
    font-size: var(--global-font-size-xs);
  }

  .assistant-message__interrupted::before,
  .assistant-message__interrupted::after {
    content: "";
    height: 1px;
    flex: 1;
    background-color: var(--global-color-warning-500);
  }

  .assistant-message__interrupted-label {
    flex: none;
  }
`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Renders a user message bubble (right-aligned, primary colour) with a toolbar
 * for copying the message and, when `onRewindRequest` is provided, rewinding or
 * branching the conversation from it.
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
  const hasText = text.trim().length > 0;

  return (
    <Message from="user">
      <MessageContent>{text}</MessageContent>
      {hasText || onRewindRequest ? (
        <MessageToolbar>
          <MessageActions>
            <MessageCopyAction text={text} />
            {onRewindRequest ? (
              <MessageRewindActions
                messageId={message.id}
                role="user"
                onRequest={onRewindRequest}
              />
            ) : null}
          </MessageActions>
        </MessageToolbar>
      ) : null}
    </Message>
  );
}

/**
 * Renders an assistant message consisting of interleaved text and tool-call
 * parts. Every tool call renders individually as a collapsible {@link ToolPart}
 * so no call is hidden behind a collapsed summary.
 *
 * `showActions` gates the feedback/copy/trace toolbar — callers should set
 * it to `false` while this particular message is still streaming so users
 * don't interact with incomplete content.
 *
 * `pinToolbar` keeps the toolbar always visible instead of revealing it on
 * hover/focus. Callers use it for the most recent assistant turn, whose actions
 * (copy, feedback, trace) are the ones users reach for most often.
 *
 * `allowRewind` gates the rewind control. Callers set it to `false` for the
 * last assistant turn, where rewinding to that response is a no-op (see
 * {@link MessageRewindActions}); branch stays available there.
 */
export function AssistantMessage({
  message,
  showActions = true,
  pinToolbar = false,
  onRewindRequest,
  allowRewind = true,
}: {
  message: AgentUIMessage;
  showActions?: boolean;
  pinToolbar?: boolean;
  onRewindRequest?: MessageRewindRequest;
  allowRewind?: boolean;
}) {
  const segments = partitionMessageParts(message.parts);
  const isInterrupted =
    getAssistantMessageMetadata(message)?.interrupted === true;

  return (
    <Message from="assistant" data-pin-toolbar={pinToolbar || undefined}>
      <MessageContent>
        <div css={assistantMessageCSS} className="assistant-message">
          {segments.map((segment) => {
            switch (segment.kind) {
              case "text":
                return (
                  <MarkdownBlock
                    key={`text-${segment.index}`}
                    mode="markdown"
                    renderMode="streaming"
                    margin="none"
                  >
                    {segment.part.type === "text" ? segment.part.text : ""}
                  </MarkdownBlock>
                );
              case "tool-solo":
                return (
                  <ToolPart key={`tool-${segment.index}`} part={segment.part} />
                );
              case "generative-ui":
                return (
                  <GenerativeUI
                    key={`generative-ui-${segment.index}`}
                    parts={[segment.part]}
                  />
                );
              default:
                return null;
            }
          })}
          {isInterrupted ? (
            <div className="assistant-message__interrupted" role="status">
              <span className="assistant-message__interrupted-label">
                {segments.length > 0
                  ? "Response interrupted"
                  : "Interrupted before a response was generated"}
              </span>
            </div>
          ) : null}
        </div>
      </MessageContent>
      {showActions ? (
        <AssistantMessageActions message={message}>
          {onRewindRequest ? (
            <MessageRewindActions
              messageId={message.id}
              role="assistant"
              onRequest={onRewindRequest}
              showRewind={allowRewind}
              traceId={
                getAssistantMessageMetadata(message)?.turnTraceContext?.traceId
              }
            />
          ) : null}
        </AssistantMessageActions>
      ) : null}
    </Message>
  );
}
