import { css, keyframes } from "@emotion/react";
import type { ChatStatus } from "ai";
import {
  type CSSProperties,
  type ReactNode,
  useRef,
  type PropsWithChildren,
  useState,
  useSyncExternalStore,
} from "react";
import { useStickToBottom } from "use-stick-to-bottom";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { Icon, Icons } from "@phoenix/components";
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
import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { AgentConsentGate } from "./AgentConsentGate";
import { AgentContextPills } from "./AgentContextPills";
import { ChatLantern } from "./ChatLantern";
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
  "Ask questions about Phoenix, get help with \n tracing, datasets, evaluations, and more.";

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

type EmptyStateLayoutMode =
  | "compact-narrow"
  | "compact-wide"
  | "bleed-small"
  | "bleed-large"
  | "roomy";

const DEFAULT_EMPTY_STATE_LAYOUT_MODE: EmptyStateLayoutMode = "bleed-large";
const CHAT_SIDEBAR_INSET_CSS = "var(--global-dimension-size-200)";

function subscribeToViewportChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function getEmptyStateLayoutMode(): EmptyStateLayoutMode {
  if (typeof window === "undefined") {
    return DEFAULT_EMPTY_STATE_LAYOUT_MODE;
  }

  if (window.innerHeight <= 720) {
    return window.innerWidth >= 720 ? "compact-wide" : "compact-narrow";
  }

  if (window.innerHeight <= 840) {
    return "bleed-small";
  }

  if (window.innerHeight <= 960) {
    return "bleed-large";
  }

  return "roomy";
}

function getEmptyStateLayoutVars(layoutMode: EmptyStateLayoutMode) {
  switch (layoutMode) {
    case "compact-narrow":
      return {
        glyphSize: 220,
        glyphFrameSize: 88,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
    case "compact-wide":
      return {
        glyphSize: 220,
        glyphFrameSize: 104,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
    case "bleed-small":
      return {
        glyphSize: 300,
        glyphFrameSize: 300,
        glyphBleedTop: "calc(-1 * var(--global-dimension-size-750))",
        heroMinHeight: "123px",
        heroPaddingTop: "var(--global-dimension-size-2500)",
      };
    case "bleed-large":
      return {
        glyphSize: 380,
        glyphFrameSize: 380,
        glyphBleedTop: "calc(-1 * var(--global-dimension-size-700))",
        heroMinHeight: "123px",
        heroPaddingTop: "var(--global-dimension-size-3600)",
      };
    case "roomy":
      return {
        glyphSize: 380,
        glyphFrameSize: 380,
        glyphBleedTop: "0px",
        heroMinHeight: "auto",
        heroPaddingTop: "0px",
      };
  }
}

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
      /* Remove bottom padding from chat input when children are present. */
      padding-bottom: 0;
    }
  }

  .chat__scroll-frame {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  &.chat--empty-bleed {
    .chat__scroll-frame,
    .chat__scroll {
      overflow: visible;
    }
  }

  .chat__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  @media (prefers-reduced-motion: reduce) {
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
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200)
      var(--chat-sidebar-inset);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__input {
    flex-shrink: 0;
    margin: 0 auto;
    position: relative;
    z-index: 2;
    /* Respects sidebar inset until the sidebar is wider than the max input size. */
    width: min(
      var(--global-dimension-size-8500),
      max(0px, calc(100% - (2 * var(--chat-sidebar-inset))))
    );
    padding-top: var(--global-dimension-size-100);
    padding-bottom: var(--global-dimension-size-250);
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 200ms forwards;
  }

  .chat__empty {
    container-type: inline-size;
    width: min(100%, var(--global-dimension-size-8500));
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-200);
    padding: 0;
    color: var(--global-text-color-300);

    @container (max-width: 479px) {
      .chat__empty-hero {
        width: auto;
      }
    }
  }

  .chat__empty--row-layout {
    @container (max-width: 479px) {
      .chat__empty-glyph {
        display: none;
      }
    }
  }

  .chat__empty-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    box-sizing: border-box;
    gap: var(--global-dimension-size-150);
    min-height: var(--chat-empty-hero-min-height, auto);
    padding-top: var(--chat-empty-hero-padding-top, 0px);
    width: min(100%, 640px);
  }

  .chat__empty-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--chat-empty-copy-gap, var(--global-dimension-size-100));
  }

  .chat__empty-glyph {
    width: var(--chat-empty-glyph-frame-size, var(--chat-empty-glyph-size, 320px));
    height: var(--chat-empty-glyph-frame-size, var(--chat-empty-glyph-size, 320px));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  .chat__empty--bleed {
    .chat__empty-glyph {
      position: absolute;
      top: var(--chat-empty-glyph-bleed-top, 0px);
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 1;
    }

    .chat__empty-copy,
    .chat__empty-actions {
      position: relative;
      z-index: 2;
    }
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
    white-space: pre-line;
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 300ms forwards;
  }

  .chat__empty-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--chat-empty-actions-gap, var(--global-dimension-size-100));
    margin-top: var(
      --chat-empty-actions-margin-top,
      var(--global-dimension-size-100)
    );
  }

  .chat__empty-action {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--chat-empty-action-padding-block, var(--global-dimension-size-150))
      var(--chat-empty-action-padding-inline, var(--global-dimension-size-200));
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

  @media (max-height: 720px) and (min-width: 720px) {
    .chat__empty-hero {
      width: 450px;
      flex-direction: row;
      align-items: center;
      justify-content: space-evenly;
      gap: var(--global-dimension-size-200);
    }

    .chat__empty-copy {
      max-width: 320px;
    }
  }

  @media (max-height: 570px) {
    .chat__empty-hero {
      display: none;
    }
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
  const emptyStateLayoutMode = useSyncExternalStore(
    subscribeToViewportChange,
    getEmptyStateLayoutMode,
    () => DEFAULT_EMPTY_STATE_LAYOUT_MODE
  );
  const emptyStateLayoutVars = getEmptyStateLayoutVars(emptyStateLayoutMode);
  const showsEmptyState = messages.length === 0;
  const showsBleedingGlyph = ["bleed-small", "bleed-large"].includes(
    emptyStateLayoutMode
  );
  const usesRowLayout = emptyStateLayoutMode === "compact-wide";
  const chatClassName = showsEmptyState ? "chat--empty chat--empty-bleed" : "";

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div
      css={chatCSS}
      className={chatClassName}
      style={{
        "--chat-sidebar-inset": CHAT_SIDEBAR_INSET_CSS,
      } as CSSProperties}
    >
      <ChatLantern isVisible={showsEmptyState} />
      <div className="chat__scroll-frame">
        <div className="chat__scroll" ref={scrollRef}>
          <div className="chat__messages" ref={contentRef}>
            {showsEmptyState && (
              <EmptyState
                key={theme}
                subtext={emptyStateSubtext}
                quickActions={emptyStateQuickActions}
                onQuickAction={handleQuickAction}
                layoutVars={emptyStateLayoutVars}
                usesRowLayout={usesRowLayout}
                showsBleedingGlyph={showsBleedingGlyph}
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
      </div>
    </div>
  );
}

/** Empty-state shown before the first user message in a session. */
function EmptyState({
  subtext,
  quickActions,
  onQuickAction,
  layoutVars,
  usesRowLayout,
  showsBleedingGlyph,
}: {
  subtext: ReactNode;
  quickActions: EmptyStateQuickAction[];
  onQuickAction: (prompt: string) => void;
  layoutVars: ReturnType<typeof getEmptyStateLayoutVars>;
  usesRowLayout: boolean;
  showsBleedingGlyph: boolean;
}) {
  return (
    <div
      className={[
        "chat__empty",
        usesRowLayout ? "chat__empty--row-layout" : null,
        showsBleedingGlyph ? "chat__empty--bleed" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--chat-empty-glyph-size": `${layoutVars.glyphSize}px`,
        "--chat-empty-glyph-frame-size": `${layoutVars.glyphFrameSize}px`,
        "--chat-empty-glyph-bleed-top": layoutVars.glyphBleedTop,
        "--chat-empty-hero-min-height": layoutVars.heroMinHeight,
        "--chat-empty-hero-padding-top": layoutVars.heroPaddingTop,
      } as CSSProperties}
    >
      <div className="chat__empty-hero">
        <div className="chat__empty-glyph">
          <PxiShaderGlyph size={layoutVars.glyphSize} />
        </div>
        <div className="chat__empty-copy">
          <h2 className="chat__empty-title">Meet PXI, your Phoenix assistant</h2>
          <p className="chat__empty-subtext">{subtext}</p>
        </div>
      </div>
      {quickActions.length > 0 && (
        <div className="chat__empty-actions">
          {quickActions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              className="chat__empty-action"
              style={
                {
                  "--chat-empty-action-delay": `${400 + index * 80}ms`,
                } as CSSProperties
              }
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
