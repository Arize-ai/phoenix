import { css } from "@emotion/react";
import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef } from "react";

import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { Icon, Icons, View } from "@phoenix/components";
import { ElicitationCarousel } from "@phoenix/components/ai/elicitation";
import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@phoenix/components/ai/prompt-input";
import { Shimmer } from "@phoenix/components/ai/shimmer";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import { AgentDebugMenu } from "./AgentDebugMenu";
import { AgentModelMenu } from "./AgentModelMenu";
import { AssistantMessage, UserMessage } from "./ChatMessage";
import { useAgentChat } from "./useAgentChat";

const chatCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .chat__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable both-edges;
  }

  .chat__messages {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200) var(--global-dimension-size-150);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__input {
    flex-shrink: 0;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    padding-top: var(--global-dimension-size-100);
    padding-bottom: var(--global-dimension-size-200);
    background-color: var(--global-color-gray-75);
  }

  .chat__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-400);
    color: var(--global-text-color-300);
  }

  .chat__loading {
    color: var(--global-text-color-300);
  }

  .chat__error {
    align-self: flex-start;
    color: var(--global-color-danger);
    font-size: var(--global-font-size-s);
  }
`;

/** Connects the presentational chat view to the agent chat controller hook. */
export function Chat({
  sessionId,
  chatApiUrl,
  modelMenuValue,
  onModelChange,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
}) {
  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
  } = useAgentChat({ sessionId, chatApiUrl });

  return (
    <ChatView
      messages={messages}
      sendMessage={sendMessage}
      stop={stop}
      status={status}
      error={error}
      pendingElicitation={pendingElicitation}
      handleElicitationSubmit={handleElicitationSubmit}
      handleElicitationCancel={handleElicitationCancel}
      modelMenuValue={modelMenuValue}
      onModelChange={onModelChange}
    />
  );
}

/**
 * Pure chat view used both by the legacy mounted panel and by the headless
 * controller path that keeps streaming alive while the panel is hidden.
 */
export function ChatView({
  messages,
  sendMessage,
  stop,
  status,
  error,
  pendingElicitation,
  handleElicitationSubmit,
  handleElicitationCancel,
  modelMenuValue,
  onModelChange,
}: {
  messages: UIMessage[];
  sendMessage: (message: { text: string }) => void;
  stop: () => Promise<void>;
  status: ChatStatus;
  error: Error | undefined;
  pendingElicitation: PendingElicitation | null;
  handleElicitationSubmit: (output: ElicitToolOutput) => void;
  handleElicitationCancel: () => void;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRequestAnimationFrameRef = useRef<number>(0);

  // Coalesce rapid message/status updates into a single smooth scroll.
  useEffect(() => {
    cancelAnimationFrame(scrollRequestAnimationFrameRef.current);
    scrollRequestAnimationFrameRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages, status]);

  useEffect(() => {
    return () => cancelAnimationFrame(scrollRequestAnimationFrameRef.current);
  }, []);

  return (
    <div css={chatCSS}>
      <div className="chat__scroll">
        <div className="chat__messages">
          {messages.length === 0 && <EmptyState />}
          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} parts={message.parts} />
            ) : (
              <AssistantMessage key={message.id} parts={message.parts} />
            )
          )}
          {status === "submitted" && <Loading />}
          {error && <ErrorMessage error={error} />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat__input">
        <View paddingX="size-200">
          {pendingElicitation ? (
            <PromptInput status={status} isDisabled mode="elicitation">
              <ElicitationCarousel
                questions={pendingElicitation.questions}
                onSubmit={handleElicitationSubmit}
                onCancel={handleElicitationCancel}
              />
            </PromptInput>
          ) : (
            <PromptInput
              onSubmit={(text) => sendMessage({ text })}
              status={status}
            >
              <PromptInputBody>
                <PromptInputTextarea placeholder="Send a message..." />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <AgentModelMenu
                    value={modelMenuValue}
                    onChange={onModelChange}
                    placement="top start"
                    shouldFlip
                    variant="quiet"
                  />
                  <AgentDebugMenu />
                </PromptInputTools>
                <PromptInputActions>
                  <PromptInputSubmit
                    onPress={() => {
                      void stop();
                    }}
                  />
                </PromptInputActions>
              </PromptInputFooter>
            </PromptInput>
          )}
        </View>
      </div>
    </div>
  );
}

/** Empty-state shown before the first user message in a session. */
function EmptyState() {
  return (
    <div className="chat__empty">
      <Icon
        svg={<Icons.Robot />}
        css={css`
          font-size: 48px;
        `}
      />
      <p>Send a message to chat with PXI</p>
    </div>
  );
}

/** Loading affordance shown while the assistant response is pending. */
function Loading() {
  return <Shimmer size="M">Thinking...</Shimmer>;
}

/** Inline request error banner for the active chat turn. */
function ErrorMessage({ error }: { error: Error }) {
  return <p className="chat__error">{error.message}</p>;
}
