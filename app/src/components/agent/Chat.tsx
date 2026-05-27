import { css, keyframes } from "@emotion/react";
import type { ChatStatus } from "ai";
import {
  type CSSProperties,
  type ReactNode,
  useRef,
  type PropsWithChildren,
  useState,
} from "react";
import { useStickToBottom } from "use-stick-to-bottom";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
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
import {
  AgentModelCredentialForm,
  useAgentModelCredentialStatus,
} from "./AgentModelCredentialForm";
import { AgentModelMenu } from "./AgentModelMenu";
import { ChatEmptyState, type EmptyStateQuickAction } from "./ChatEmptyState";
import { ChatLantern } from "./ChatLantern";
import { AssistantMessage, UserMessage } from "./ChatMessage";
import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "./ElicitationDraftContext";
import { PxiGlyph } from "./PxiGlyph";
import { useAgentChat } from "./useAgentChat";
import type { AgentModelSelection } from "./useGenerateSessionSummary";

export type { EmptyStateQuickAction } from "./ChatEmptyState";

const CHAT_SIDEBAR_INSET_CSS = "var(--global-dimension-size-200)";

function createPendingElicitationDraft(
  toolCallId: string
): PendingElicitationDraft {
  return {
    toolCallId,
    answers: {},
    freeformTexts: {},
    currentIndex: 0,
  };
}

const chatInputFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
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

  .chat__empty-title {
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 400ms forwards;
  }

  .chat__empty-subtext {
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out 300ms forwards;
  }

  .chat__empty-action {
    opacity: 0;
    animation: ${chatEmptyItemFadeUp} 500ms ease-out var(--chat-empty-action-delay, 700ms)
      forwards;
  }

  .chat__messages {
    box-sizing: border-box;
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

  &.chat--empty {
    .chat__messages {
      min-height: 100%;
      width: 100%;
    }

    .chat__empty {
      margin-block: auto;
    }
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
    animation: ${chatInputFadeUp} 280ms ease-out;
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
  modelSelection,
  modelMenuValue,
  onModelChange,
  emptyStateSubtext,
  emptyStateQuickActions,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  modelSelection: AgentModelSelection;
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
  } = useAgentChat({ sessionId, chatApiUrl, modelSelection });

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
  emptyStateSubtext,
  emptyStateQuickActions,
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
  const { theme } = useTheme();
  const { contentRef, scrollRef, scrollToBottom } = useStickToBottom();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [elicitationDraft, setElicitationDraft] =
    useState<PendingElicitationDraft | null>(null);
  const hasAcknowledgedConsent = useAgentContext(
    (state) => state.observability.hasAcknowledgedConsent
  );
  const showsEmptyState = messages.length === 0;
  const chatClassName = showsEmptyState ? "chat--empty" : "";
  const { missingCredentialsProvider, refreshCredentialStatus } =
    useAgentModelCredentialStatus(modelMenuValue);
  const isWaitingForAssistant =
    status === "submitted" || status === "streaming";
  const isSendDisabledForMissingCredentials =
    !isWaitingForAssistant && Boolean(missingCredentialsProvider);
  const resolvedElicitationDraft =
    pendingElicitation &&
    elicitationDraft?.toolCallId !== pendingElicitation.toolCallId
      ? createPendingElicitationDraft(pendingElicitation.toolCallId)
      : elicitationDraft;

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

  return (
    <ElicitationDraftProvider draft={resolvedElicitationDraft}>
      <div
        css={chatCSS}
        className={chatClassName}
        style={
          {
            "--chat-sidebar-inset": CHAT_SIDEBAR_INSET_CSS,
          } as CSSProperties
        }
      >
        <ChatLantern isVisible={showsEmptyState} />
        <div className="chat__scroll-frame">
          <div className="chat__scroll" ref={scrollRef}>
            <div className="chat__messages" ref={contentRef}>
              {showsEmptyState && (
                <ChatEmptyState
                  key={theme}
                  subtext={emptyStateSubtext}
                  quickActions={emptyStateQuickActions}
                  onQuickAction={handleQuickAction}
                >
                  {missingCredentialsProvider ? (
                    <AgentModelCredentialForm
                      modelName={modelMenuValue.modelName}
                      onCredentialsUpdated={refreshCredentialStatus}
                      provider={missingCredentialsProvider}
                    />
                  ) : undefined}
                </ChatEmptyState>
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
                key={pendingElicitation.toolCallId}
                questions={pendingElicitation.questions}
                onProgressStateChange={(draftState) => {
                  setElicitationDraft({
                    toolCallId: pendingElicitation.toolCallId,
                    ...draftState,
                  });
                }}
                onSubmit={(output) => {
                  setElicitationDraft({
                    toolCallId: pendingElicitation.toolCallId,
                    answers: output.answers,
                    freeformTexts: output.freeformTexts,
                    currentIndex: Math.max(
                      0,
                      pendingElicitation.questions.length - 1
                    ),
                  });
                  void scrollToBottom();
                  handleElicitationSubmit(output);
                }}
                onCancel={() => {
                  setElicitationDraft(null);
                  handleElicitationCancel();
                }}
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
                    isDisabled={
                      isSendDisabledForMissingCredentials || undefined
                    }
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
    </ElicitationDraftProvider>
  );
}

const loadingCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  color: var(--global-text-color-700);
`;

/** Loading affordance shown while the assistant response is pending. */
function Loading() {
  return (
    <div css={loadingCSS}>
      <PxiGlyph animation="wave-hold" size={12} />
      <Shimmer size="S" weight="heavy">
        Thinking...
      </Shimmer>
    </div>
  );
}

/** Inline request error banner for the active chat turn. */
function ErrorMessage({ error }: { error: Error }) {
  return <p className="chat__error">{error.message}</p>;
}
