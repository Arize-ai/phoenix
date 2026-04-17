import { css } from "@emotion/react";
import type { ChatStatus } from "ai";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
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
import { PxiGlyph } from "./PxiGlyph";
import { useAgentChat } from "./useAgentChat";

export type EmptyStateQuickAction = {
  icon: ReactNode;
  label: string;
  /** Prompt text sent to the chat when the action is pressed. */
  prompt: string;
};

const DEFAULT_EMPTY_STATE_SUBTEXT =
  "Ask questions about Phoenix, get help with tracing, datasets, evaluations, and more.";

const DEFAULT_EMPTY_STATE_QUICK_ACTIONS: EmptyStateQuickAction[] = [
  {
    icon: <Icons.BulbOutline />,
    label: "How do I use Phoenix?",
    prompt: "How do I use Phoenix?",
  },
  {
    icon: <Icons.BookOutline />,
    label: "Explain a concept",
    prompt: "Explain a Phoenix concept to me.",
  },
  {
    icon: <Icons.Trace />,
    label: "Find critical issues",
    prompt: "Find critical issues in my traces.",
  },
];

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
    gap: var(--global-dimension-size-200);
    margin-top: var(--global-dimension-size-600);
    padding: 0 var(--global-dimension-size-200);
    color: var(--global-text-color-300);
  }

  .chat__empty-glyph {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--global-color-primary);
    background: radial-gradient(
      circle at center,
      var(--global-color-primary-100) 0%,
      transparent 65%
    );
  }

  .chat__empty-title {
    margin: 0;
    font-size: var(--global-font-size-l);
    font-weight: var(--px-font-weight-heavy, 600);
    color: var(--global-text-color-900);
    text-align: center;
  }

  .chat__empty-subtext {
    margin: 0;
    text-align: center;
    color: var(--global-text-color-500);
    line-height: var(--global-line-height-m);
  }

  .chat__empty-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-100);
  }

  .chat__empty-action {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    background: transparent;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .chat__empty-action:hover {
    background: var(--global-color-gray-100);
    border-color: var(--global-border-color-hover, var(--global-color-gray-300));
    color: var(--global-text-color-900);
  }

  .chat__empty-action-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--global-text-color-500);
    font-size: 16px;
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
  emptyStateSubtext,
  emptyStateQuickActions,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
  emptyStateSubtext?: ReactNode;
  emptyStateQuickActions?: EmptyStateQuickAction[];
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
      emptyStateSubtext={emptyStateSubtext}
      emptyStateQuickActions={emptyStateQuickActions}
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
  emptyStateSubtext = DEFAULT_EMPTY_STATE_SUBTEXT,
  emptyStateQuickActions = DEFAULT_EMPTY_STATE_QUICK_ACTIONS,
}: {
  messages: AgentUIMessage[];
  sendMessage: (message: { text: string }) => void;
  stop: () => Promise<void>;
  status: ChatStatus;
  error: Error | undefined;
  pendingElicitation: PendingElicitation | null;
  handleElicitationSubmit: (output: ElicitToolOutput) => void;
  handleElicitationCancel: () => void;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
  emptyStateSubtext?: ReactNode;
  emptyStateQuickActions?: EmptyStateQuickAction[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRequestAnimationFrameRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

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
          {messages.length === 0 && (
            <EmptyState
              subtext={emptyStateSubtext}
              quickActions={emptyStateQuickActions}
              onQuickAction={handleQuickAction}
            />
          )}
          {messages.map((message, index) => {
            if (message.role === "user") {
              return <UserMessage key={message.id} parts={message.parts} />;
            }
            // Only the last assistant message can still be streaming — hide
            // its actions until the chat reports it is settled.
            const isLast = index === messages.length - 1;
            const showActions = !isLast || status === "ready";
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                showActions={showActions}
              />
            );
          })}
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
              value={inputValue}
              onValueChange={setInputValue}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  ref={textareaRef}
                  placeholder="Send a message..."
                />
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
function EmptyState({
  subtext,
  quickActions,
  onQuickAction,
}: {
  subtext: ReactNode;
  quickActions: EmptyStateQuickAction[];
  onQuickAction: (prompt: string) => void;
}) {
  return (
    <div className="chat__empty">
      <div className="chat__empty-glyph">
        <PxiGlyph
          fill="currentColor"
          css={css`
            transform: scale(1.8);
          `}
        />
      </div>
      <h2 className="chat__empty-title">
        I&apos;m PXI, your Phoenix assistant
      </h2>
      <p className="chat__empty-subtext">{subtext}</p>
      {quickActions.length > 0 && (
        <div className="chat__empty-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="chat__empty-action"
              onClick={() => onQuickAction(action.prompt)}
            >
              <span className="chat__empty-action-icon">
                <Icon svg={action.icon} />
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
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
