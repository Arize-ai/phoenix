import { css, keyframes } from "@emotion/react";
import type { ChatStatus } from "ai";
import {
  type CSSProperties,
  type ReactNode,
  useRef,
  useMemo,
  type PropsWithChildren,
  useState,
} from "react";
import { useStickToBottom } from "use-stick-to-bottom";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { Icon, Icons, View } from "@phoenix/components";
import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
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
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useTheme } from "@phoenix/contexts";
import type { ProviderTheme } from "@phoenix/contexts";

import { AgentConsentGate } from "./AgentConsentGate";
import { AgentContextPills } from "./AgentContextPills";
import { AgentModelMenu } from "./AgentModelMenu";
import { AssistantMessage, UserMessage } from "./ChatMessage";
import { PxiShaderGlyph } from "./PxiShaderGlyph";
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

const chatLanternDrift = keyframes`
  0% {
    transform: translate3d(-14%, -14%, 0) scale(0.84);
    opacity: 0.24;
  }

  35% {
    transform: translate3d(-2%, -6%, 0) scale(0.98);
    opacity: 0.38;
  }

  62% {
    transform: translate3d(10%, 2%, 0) scale(1.18);
    opacity: 0.62;
  }

  100% {
    transform: translate3d(-6%, 10%, 0) scale(0.9);
    opacity: 0.3;
  }
`;

const chatLanternSweep = keyframes`
  0% {
    transform: translate3d(-18%, -10%, 0) rotate(-10deg) scale(1.14);
    // opacity: 0.18;
  }

  38% {
    transform: translate3d(-20%, -3%, 0) rotate(-2deg) scale(0.88);
    // opacity: 1;
  }

  68% {
    transform: translate3d(14%, 20%, 0) rotate(6deg) scale(3);
    // opacity: 0.6;
  }

  100% {
    transform: translate3d(-8%, 12%, 0) rotate(-4deg) scale(0.92);
    // opacity: 0.2;
  }
`;

const chatEmptyItemFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const chatCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: visible;
  position: relative;

  .chat__children {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--global-dimension-static-size-100);
    padding: var(--global-dimension-size-100) 0;
  }

  &:has(.chat__children > *) {
    .chat__input {
      // remove bottom padding from chat input when children present
      padding-bottom: 0;
    }
  }

  .chat__scroll-frame {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .chat__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable both-edges;
  }

  .chat__scroll-lantern {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    top: -64px;
    height: calc(100% + 64px);
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .chat__scroll-lantern::before,
  .chat__scroll-lantern::after {
    content: "";
    position: absolute;
    top: 0;
    transform-origin: top center;
    border-radius: 999px;
    will-change: transform, opacity;
  }

  .chat__scroll-lantern::before {
    left: 50%;
    top: -120px;
    width: 170%;
    height: 380px;
    opacity: 0.4;
    transform-origin: top left;
    filter: blur(30px);
    animation: ${chatLanternDrift} 0.005s ease-in-out infinite;
  }

  .chat__scroll-lantern::after {
    top: 150px;
    right: 60%;
    width: 250%;
    height: 300px;
    transform-origin: top right;
    opacity: 0.5;
    filter: blur(38px);
    animation: ${chatLanternSweep} 0.005s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat__scroll-lantern::before,
    .chat__scroll-lantern::after {
      animation-duration: 18s;
      animation-timing-function: ease-in-out;
    }

    .chat__empty-title,
    .chat__empty-subtext,
    .chat__empty-action,
    .chat__input {
      opacity: 1;
      animation: none;
      transform: none;
    }
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
    padding-bottom: var(--global-dimension-size-250);
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 200ms forwards;
  }

  .chat__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-200);
    padding: 0 var(--global-dimension-size-200);
    color: var(--global-text-color-300);
  }

  .chat__empty-glyphs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-150);
  }

  .chat__empty-glyph {
    width: min(320px, calc(100vw - 64px));
    height: min(320px, calc(100vw - 64px));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chat__empty-glyph--secondary {
    width: min(240px, calc(100vw - 96px));
    height: min(240px, calc(100vw - 96px));
  } 

  .chat__empty-title {
    margin: 0;
    font-size: var(--global-font-size-l);
    font-weight: var(--px-font-weight-heavy, 600);
    color: var(--global-text-color-900);
    text-align: center;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 400ms forwards;
  }

  .chat__empty-subtext {
    margin: 0;
    text-align: center;
    color: var(--global-text-color-500);
    line-height: var(--global-line-height-m);
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 300ms forwards;
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
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out var(--chat-empty-action-delay, 700ms)
      forwards;
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

/** Theme-specific gradient colors and blend mode for the ambient lantern effect. */
function getLanternCSS(theme: ProviderTheme) {
  const isDark = theme === "dark";
  const blendMode = isDark ? "screen" : "multiply";

  // Dark: bright-on-dark via screen. Light: dark-on-light via multiply.
  const beforeBackground = isDark
    ? `
      radial-gradient(
        ellipse at 38% 18%,
        rgba(242, 247, 255, 0.2) 0%,
        rgba(203, 224, 255, 0.14) 26%,
        rgba(169, 191, 255, 0.09) 46%,
        rgba(158, 148, 255, 0.05) 62%,
        rgba(158, 148, 255, 0) 84%
      ),
      linear-gradient(
        180deg,
        rgba(225, 236, 255, 0.08) 0%,
        rgba(225, 236, 255, 0) 100%
      )`
    : `
      radial-gradient(
        ellipse at 38% 18%,
        rgba(183, 192, 207, 0.28) 0%,
        rgba(159, 168, 187, 0.18) 26%,
        rgba(140, 149, 170, 0.10) 46%,
        rgba(116, 119, 146, 0.05) 62%,
        rgba(116, 119, 146, 0) 84%
      ),
      linear-gradient(
        180deg,
        rgba(191, 198, 210, 0.10) 0%,
        rgba(191, 198, 210, 0) 100%
      )`;

  const afterBackground = isDark
    ? `
      radial-gradient(
        ellipse at 64% 16%,
        rgba(255, 247, 235, 0.18) 0%,
        rgba(255, 222, 193, 0.12) 24%,
        rgba(255, 196, 170, 0.08) 44%,
        rgba(255, 164, 145, 0.04) 60%,
        rgba(255, 164, 145, 0) 82%
      ),
      linear-gradient(
        180deg,
        rgba(255, 240, 224, 0.07) 0%,
        rgba(255, 240, 224, 0) 100%
      )`
    : `
      radial-gradient(
        ellipse at 64% 16%,
        rgba(144, 162, 192, 0.18) 0%,
        rgba(121, 141, 173, 0.12) 24%,
        rgba(102, 122, 156, 0.07) 44%,
        rgba(87, 107, 141, 0.03) 60%,
        rgba(87, 107, 141, 0) 82%
      ),
      linear-gradient(
        180deg,
        rgba(135, 153, 185, 0.07) 0%,
        rgba(135, 153, 185, 0) 100%
      )`;

  return css`
    .chat__scroll-lantern::before,
    .chat__scroll-lantern::after {
      mix-blend-mode: ${blendMode};
    }
    .chat__scroll-lantern::before {
      background: ${beforeBackground};
    }
    .chat__scroll-lantern::after {
      background: ${afterBackground};
    }
  `;
}

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
    >
      {sessionId ? <ChatSessionUsage sessionId={sessionId} /> : null}
    </ChatView>
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
  children,
  emptyStateSubtext = DEFAULT_EMPTY_STATE_SUBTEXT,
  emptyStateQuickActions = DEFAULT_EMPTY_STATE_QUICK_ACTIONS,
}: PropsWithChildren<{
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
}>) {
  const { contentRef, scrollRef, scrollToBottom } = useStickToBottom();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const hasAcknowledgedConsent = useAgentContext(
    (state) => state.observability.hasAcknowledgedConsent
  );
  const { theme } = useTheme();
  const themedLanternCSS = useMemo(() => getLanternCSS(theme), [theme]);

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div css={[chatCSS, themedLanternCSS]}>
      <div className="chat__scroll-lantern" aria-hidden="true" />
      <div className="chat__scroll-frame">
        <div className="chat__scroll" ref={scrollRef}>
          <div className="chat__messages" ref={contentRef}>
            {messages.length === 0 && (
              <EmptyState
                key={theme}
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
          </div>
        </div>
      </div>
      <div className="chat__input">
        <View paddingX="size-200">
          {!hasAcknowledgedConsent ? (
            <PromptInput status={status} isDisabled mode="elicitation">
              <AgentConsentGate />
            </PromptInput>
          ) : pendingElicitation ? (
            <PromptInput status={status} isDisabled mode="elicitation">
              <ElicitationCarousel
                questions={pendingElicitation.questions}
                onSubmit={(output) => {
                  void scrollToBottom();
                  handleElicitationSubmit(output);
                }}
                onCancel={handleElicitationCancel}
              />
            </PromptInput>
          ) : (
            <PromptInput
              onSubmit={(text) => {
                void scrollToBottom();
                sendMessage({ text });
              }}
              status={status}
              value={inputValue}
              onValueChange={setInputValue}
            >
              <AgentContextPills />
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
          {children ? <div className="chat__children">{children}</div> : null}
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
      <div className="chat__empty-glyphs">
        <div className="chat__empty-glyph">
          <PxiShaderGlyph size={320} />
        </div>
      </div>
      <h2 className="chat__empty-title">
        Meet PXI, your Phoenix assistant
      </h2>
      <p className="chat__empty-subtext">{subtext}</p>
      {quickActions.length > 0 && (
        <div className="chat__empty-actions">
          {quickActions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              className="chat__empty-action"
              style={{
                "--chat-empty-action-delay": `${400 + index * 80}ms`,
              } as CSSProperties}
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
