import { css, keyframes } from "@emotion/react";
import type { ChatStatus } from "ai";
import {
  Fragment,
  useCallback,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  type PropsWithChildren,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useStickToBottom } from "use-stick-to-bottom";

import {
  getCompactionSummary,
  isCompactionMessage,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { useAgentQuickActions } from "@phoenix/agent/quickActions/quickActions";
import type { PromptCommandContext } from "@phoenix/agent/slashCommands/promptCommands";
import { runPromptCommands } from "@phoenix/agent/slashCommands/runPromptCommands";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { ElicitationCarousel } from "@phoenix/components/ai/elicitation";
import { PromptInput } from "@phoenix/components/ai/prompt-input";
import { Shimmer } from "@phoenix/components/ai/shimmer";
import { ExpandableContent } from "@phoenix/components/core/content/ExpandableContent";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { MarkdownBlock } from "@phoenix/components/markdown";
import { useTheme } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  DRAFT_SESSION_ID,
  hasAcknowledgedCurrentTraceConsent,
} from "@phoenix/store/agentStore";

import { AgentChatInput } from "./AgentChatInput";
import { AgentConsentGate } from "./AgentConsentGate";
import {
  AgentEditPermissionMenu,
  getNextEditPermissionMode,
} from "./AgentEditPermissionMenu";
import {
  AgentModelCredentialForm,
  useAgentModelCredentialStatus,
} from "./AgentModelCredentialForm";
import { ChatEmptyState, type EmptyStateQuickAction } from "./ChatEmptyState";
import { ChatErrorMessage } from "./ChatErrorMessage";
import { ChatLantern } from "./ChatLantern";
import {
  AssistantMessage,
  type MessageRewindRequest,
  UserMessage,
} from "./ChatMessage";
import { ChatScrollContext } from "./ChatScrollContext";
import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "./ElicitationDraftContext";
import { InterruptedChatMessage } from "./InterruptedChatMessage";
import {
  MessageRewindConfirmation,
  type MessageRewindMode,
  type MessageRewindRole,
} from "./MessageRewindDialog";
import { PxiGlyph } from "./PxiGlyph";
import { useScrollAnchor } from "./scrollAnchor";
import { TemporaryChatToggle } from "./TemporaryChatToggle";
import { isToolUIPart } from "./toolPartTypes";

export type { EmptyStateQuickAction } from "./ChatEmptyState";

const CHAT_SIDEBAR_INSET_CSS = "var(--global-dimension-size-200)";

/**
 * Keeps the trailing Thinking indicator visible for the initial request wait
 * and while the latest assistant turn ends in a tool call.
 */
function shouldShowThinkingIndicator({
  status,
  messages,
}: {
  status: ChatStatus;
  messages: AgentUIMessage[];
}): boolean {
  if (status === "submitted") {
    return true;
  }
  if (status !== "streaming") {
    return false;
  }

  const latestMessage = messages.at(-1);
  if (latestMessage?.role !== "assistant") {
    return false;
  }

  const latestRelevantPart = latestMessage.parts.findLast(
    (part) => part.type !== "text" || part.text.trim() !== ""
  );
  return latestRelevantPart != null && isToolUIPart(latestRelevantPart);
}

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

const compactionProgressPulse = keyframes`
  0%, 100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
`;

const chatCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: visible;
  position: relative;

  .chat__input-meta {
    box-sizing: border-box;
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    column-gap: var(--global-dimension-size-100);
    row-gap: 0;
    /* Match the prompt input footer's horizontal inset so the permission
       selector and token usage line up with the tools/submit row above. */
    padding: var(--global-dimension-size-100) 0;
  }

  &:has(.chat__input-meta) {
    .chat__input {
      /* Remove bottom padding when metadata is rendered below the prompt. */
      padding-bottom: 0;
    }
  }

  .chat__children {
    display: contents;
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
    animation: ${chatEmptyItemFadeUp} 500ms ease-out
      var(--chat-empty-action-delay, 700ms) forwards;
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
    padding: var(--global-dimension-size-200) var(--chat-sidebar-inset);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__compaction-divider {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    width: 100%;
    margin: var(--global-dimension-size-100) 0;
    color: var(--global-text-color-300);
    font-size: var(--global-font-size-xs);
  }

  .chat__compaction-divider::before,
  .chat__compaction-divider::after {
    content: "";
    height: 1px;
    flex: 1;
    background-color: var(--global-border-color-default);
  }

  .chat__compaction-divider-label {
    flex: none;
  }

  .chat__compaction-progress {
    animation: ${compactionProgressPulse} 1.4s ease-in-out infinite;
  }

  .chat__compaction-summary {
    margin-bottom: var(--global-dimension-size-100);
    padding: 0 var(--global-dimension-size-100);
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

  /* Elicitation-style surfaces (consent gate, rewind confirmation, question
     carousel) can be taller than the panel; let the input region shrink and
     scroll internally instead of clipping at the panel edge. */
  .chat__input:has([data-input-mode="elicitation"]) {
    flex-shrink: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .chat__loading {
    color: var(--global-text-color-300);
  }

  .chat__edit-permissions {
    flex: none;
  }
`;

function getLatestMessageId({
  messages,
  role,
}: {
  messages: AgentUIMessage[];
  role: AgentUIMessage["role"];
}): string | undefined {
  return messages.findLast((message) => message.role === role)?.id;
}

function getMessageText(message: AgentUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const COMPACTION_SUMMARY_SECTIONS = [
  ["objectives", "Objectives"],
  ["constraints_and_preferences", "Constraints and preferences"],
  ["decisions", "Decisions"],
  ["completed_work", "Completed work"],
  ["active_work", "Active work"],
  ["blockers", "Blockers"],
  ["next_steps", "Next steps"],
  ["important_details", "Important details"],
] as const;

const COMPACTION_SUMMARY_COLLAPSED_HEIGHT_PX = 320;

function getCompactionSummaryMarkdown(summary: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(summary);
  } catch {
    return summary;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return summary;
  }
  const record = parsed as Record<string, unknown>;
  const sections = COMPACTION_SUMMARY_SECTIONS.flatMap(([key, label]) => {
    const items = Array.isArray(record[key])
      ? record[key].filter(
          (item): item is string =>
            typeof item === "string" && item.trim() !== ""
        )
      : [];
    if (items.length === 0) {
      return [];
    }
    const markdownItems = items
      .map((item) => `- ${item.trim().replaceAll("\n", "\n  ")}`)
      .join("\n");
    return [`### ${label}\n\n${markdownItems}`];
  });
  return sections.length > 0 ? sections.join("\n\n") : summary;
}

function ChatCompaction({ summary }: { summary: string }) {
  const containerRef = useRef<HTMLElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAnchor = useScrollAnchor();
  const markdown = getCompactionSummaryMarkdown(summary);
  const handleExpandedChange = useCallback(
    (nextIsExpanded: boolean) => {
      scrollAnchor.capture(containerRef.current);
      setIsExpanded(nextIsExpanded);
      requestAnimationFrame(() => scrollAnchor.restore(containerRef.current));
    },
    [scrollAnchor]
  );

  return (
    <>
      <div
        className="chat__compaction-divider"
        role="separator"
        aria-label="Conversation context compacted"
      >
        <span className="chat__compaction-divider-label">
          Context compacted
        </span>
      </div>
      <section
        ref={containerRef}
        className="chat__compaction-summary"
        aria-label="Compaction summary"
      >
        <ExpandableContent
          height={COMPACTION_SUMMARY_COLLAPSED_HEIGHT_PX}
          expandedBehavior="grow"
          isExpanded={isExpanded}
          onExpandedChange={handleExpandedChange}
        >
          <MarkdownBlock mode="markdown" margin="none">
            {markdown}
          </MarkdownBlock>
        </ExpandableContent>
      </section>
    </>
  );
}

function ChatCompactionProgress() {
  return (
    <div
      className="chat__compaction-divider chat__compaction-progress"
      role="status"
      aria-live="polite"
    >
      <span className="chat__compaction-divider-label">
        Compacting conversation…
      </span>
    </div>
  );
}

/**
 * Pure chat view used both by the legacy mounted panel and by the headless
 * controller path that keeps streaming alive while the panel is hidden.
 */
export function ChatView({
  sessionId,
  messages,
  sendMessage,
  stop,
  status,
  error,
  pendingElicitation,
  handleElicitationSubmit,
  handleElicitationCancel,
  compactSession,
  isCompacting = false,
  rewindToMessage,
  forkFromMessage,
  modelMenuValue,
  onModelChange,
  children,
  emptyStateSubtext,
  emptyStateQuickActions,
  autoFocusInput = false,
}: PropsWithChildren<{
  sessionId?: string | null;
  messages: AgentUIMessage[];
  sendMessage: (
    message: { text: string },
    options?: { body?: Record<string, unknown> }
  ) => void;
  stop: () => Promise<void>;
  status: ChatStatus;
  error: Error | undefined;
  pendingElicitation: PendingElicitation | null;
  handleElicitationSubmit: (output: ElicitToolOutput) => void;
  handleElicitationCancel: () => void;
  compactSession: PromptCommandContext["compactSession"];
  isCompacting?: boolean;
  /**
   * Truncates the active session at a message; resolves to user text to
   * restore. Absent on read-only surfaces, which hides the rewind/branch
   * controls.
   */
  rewindToMessage?: (messageId: string) => Promise<string | null>;
  /** Branches a new session from a message; absent hides the branch control. */
  forkFromMessage?: (messageId: string) => void;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
  emptyStateSubtext?: ReactNode;
  emptyStateQuickActions?: EmptyStateQuickAction[];
  autoFocusInput?: boolean;
}>) {
  const { theme } = useTheme();
  const { contentRef, scrollRef, scrollToBottom, stopScroll } =
    useStickToBottom({
      initial: "instant",
      resize: "instant",
    });
  const chatScrollContextValue = useMemo(() => ({ stopScroll }), [stopScroll]);
  const handleScrollRef = useCallback(
    (element: HTMLElement | null) => {
      scrollRef(element);
      if (!element) {
        return;
      }
      // Align restored chat history before first paint; useStickToBottom handles later
      // resize/follow behavior once its observers are attached.
      element.scrollTop = element.scrollHeight - element.clientHeight;
    },
    [scrollRef]
  );
  const store = useAgentStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftInput = useAgentContext((state) =>
    sessionId ? (state.draftInputBySessionId[sessionId] ?? "") : ""
  );
  const setDraftInput = useAgentContext((state) => state.setDraftInput);
  const [elicitationDraft, setElicitationDraft] =
    useState<PendingElicitationDraft | null>(null);
  const hasAcknowledgedConsent = useAgentContext((state) =>
    hasAcknowledgedCurrentTraceConsent({
      agentsConfig: state.agentsConfig,
      observability: state.observability,
    })
  );
  const editPermissionMode = useAgentContext(
    (state) => state.permissions.edits
  );
  const setPermissions = useAgentContext((state) => state.setPermissions);
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const isDraftSessionTemporary = useAgentContext(
    (state) => state.isDraftSessionTemporary
  );
  const setIsDraftSessionTemporary = useAgentContext(
    (state) => state.setIsDraftSessionTemporary
  );

  const setSessionDraftInput = (input: string | null) => {
    if (!sessionId) {
      return;
    }
    setDraftInput(sessionId, input);
  };

  // Send any message staged for this session (e.g. carried past `/clear` from
  // the previous session) as soon as the view mounts. Consuming is atomic, so
  // re-runs and concurrent views are no-ops after the first send.
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const pending = store.getState().consumePendingMessage(sessionId);
    if (!pending) {
      return;
    }
    sendMessage(
      { text: pending.text },
      pending.requestedSkills.length > 0
        ? { body: { requestedSkills: pending.requestedSkills } }
        : undefined
    );
  }, [sessionId, sendMessage, store]);

  const showsEmptyState = messages.length === 0;
  const chatClassName = showsEmptyState ? "chat--empty" : "";
  const { missingCredentialsProvider, refreshCredentialStatus } =
    useAgentModelCredentialStatus(modelMenuValue);
  const isWaitingForAssistant =
    status === "submitted" || status === "streaming";
  const isSendDisabledForMissingCredentials =
    !isWaitingForAssistant && Boolean(missingCredentialsProvider);
  const isSubmitDisabled = isSendDisabledForMissingCredentials || isCompacting;
  const showThinkingIndicator = shouldShowThinkingIndicator({
    status,
    messages,
  });
  const latestMessage = messages.at(-1);
  const shouldShowInterruptedMessage =
    status === "ready" && !error && latestMessage?.role === "user";
  const resolvedElicitationDraft =
    pendingElicitation &&
    elicitationDraft?.toolCallId !== pendingElicitation.toolCallId
      ? createPendingElicitationDraft(pendingElicitation.toolCallId)
      : elicitationDraft;
  const canToggleEditPermission = hasAcknowledgedConsent && !pendingElicitation;
  const canToggleTemporaryChat =
    sessionId === DRAFT_SESSION_ID && showsEmptyState && !pendingElicitation;

  const toggleEditPermission = () => {
    setPermissions({ edits: getNextEditPermissionMode(editPermissionMode) });
  };

  useHotkeys(
    "ctrl+t",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleEditPermission();
    },
    {
      enabled: canToggleEditPermission,
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [canToggleEditPermission, editPermissionMode, setPermissions]
  );

  // Quick actions track the agent contexts the assistant is advertising for the current
  // route, so the empty state suggests what the assistant can actually do here
  // (e.g. run/enhance prompts on the playground). An explicit prop still wins
  // for callers that want a fixed set.
  const contextualQuickActions = useAgentQuickActions();
  const quickActions = emptyStateQuickActions ?? contextualQuickActions;

  const handleQuickAction = (prompt: string) => {
    setSessionDraftInput(prompt);
    textareaRef.current?.focus();
  };

  // Pending rewind/branch confirmation, shown inline in place of the prompt
  // input. Panel-local because the confirmation is an inline surface, not a
  // modal — a modal would flip the global open-modal observer and re-parent
  // this panel between its docked/floating layouts, tearing the surface down.
  const [rewindRequest, setRewindRequest] = useState<{
    mode: MessageRewindMode;
    messageId: string;
    role: MessageRewindRole;
  } | null>(null);

  // Rewind/branch changes finalized history, so these actions are only offered
  // once the chat has settled — never mid-request.
  const hasChatSettled = status === "ready" || status === "error";

  const onRewindRequest = useMemo<MessageRewindRequest | undefined>(() => {
    if (!hasChatSettled || !rewindToMessage) {
      return undefined;
    }
    return (request) => setRewindRequest(request);
  }, [hasChatSettled, rewindToMessage]);

  const handleConfirmRewind = async () => {
    if (!rewindRequest) {
      return;
    }
    const { mode, messageId } = rewindRequest;
    setRewindRequest(null);
    if (mode === "fork") {
      // Forking switches the active session, which remounts this view; the
      // forked session receives restored text through draftInputBySessionId.
      forkFromMessage?.(messageId);
    } else {
      const restoredInput = (await rewindToMessage?.(messageId)) ?? null;
      if (restoredInput != null) {
        setSessionDraftInput(restoredInput);
        textareaRef.current?.focus();
      }
    }
  };

  const retryUserMessage = async (message: AgentUIMessage | undefined) => {
    if (message?.role !== "user") {
      return;
    }
    const messageText = getMessageText(message).trim();
    if (!messageText) {
      return;
    }
    // The server-side truncation must land before re-sending, or the resent
    // request would still carry the interrupted user turn.
    const restoredInput = await rewindToMessage?.(message.id);
    if (restoredInput == null) {
      return;
    }
    void scrollToBottom();
    sendMessage({ text: messageText });
  };

  const handleRetryInterruptedMessage = () => retryUserMessage(latestMessage);

  const handleRetryFailedMessage = () =>
    retryUserMessage(messages.findLast((message) => message.role === "user"));

  useLayoutEffect(() => {
    if (
      !autoFocusInput ||
      !hasAcknowledgedConsent ||
      pendingElicitation ||
      rewindRequest
    ) {
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  }, [
    autoFocusInput,
    hasAcknowledgedConsent,
    pendingElicitation,
    rewindRequest,
  ]);

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
        <ChatScrollContext.Provider value={chatScrollContextValue}>
          <div className="chat__scroll-frame">
            <div className="chat__scroll" ref={handleScrollRef}>
              <div className="chat__messages" ref={contentRef}>
                {showsEmptyState && (
                  <ChatEmptyState
                    key={theme}
                    subtext={emptyStateSubtext}
                    quickActions={quickActions}
                    onQuickAction={handleQuickAction}
                  >
                    {hasAcknowledgedConsent && missingCredentialsProvider ? (
                      <AgentModelCredentialForm
                        modelName={modelMenuValue.modelName}
                        onCredentialsUpdated={refreshCredentialStatus}
                        provider={missingCredentialsProvider}
                      />
                    ) : undefined}
                  </ChatEmptyState>
                )}
                {messages.map((message, index) => {
                  if (isCompactionMessage(message)) {
                    return (
                      <ChatCompaction
                        key={message.id}
                        summary={getCompactionSummary(message)}
                      />
                    );
                  }
                  let renderedMessage: ReactNode;
                  if (message.role === "user") {
                    renderedMessage = (
                      <UserMessage
                        message={message}
                        onRewindRequest={onRewindRequest}
                      />
                    );
                  } else {
                    // Only the last assistant message can still be streaming — hide
                    // its actions until the chat reports it is settled.
                    const isLast = index === messages.length - 1;
                    const showActions = !isLast || hasChatSettled;
                    // Pin the most recent assistant turn's toolbar so its actions
                    // stay visible; other turns reveal their toolbars on hover to
                    // cut down on stacked-toolbar clutter.
                    const pinToolbar = isLast && hasChatSettled;
                    // Rewinding to the last assistant turn is a no-op: nothing
                    // follows it to truncate and, once settled, it has no pending
                    // tool calls to clear. Hide the rewind control there.
                    renderedMessage = (
                      <AssistantMessage
                        message={message}
                        showActions={showActions}
                        pinToolbar={pinToolbar}
                        onRewindRequest={onRewindRequest}
                        allowRewind={!isLast}
                      />
                    );
                  }
                  return (
                    <Fragment key={message.id}>{renderedMessage}</Fragment>
                  );
                })}
                {isCompacting ? <ChatCompactionProgress /> : null}
                {showThinkingIndicator && <Loading />}
                {shouldShowInterruptedMessage ? (
                  <InterruptedChatMessage
                    latestUserMessageId={latestMessage.id}
                    canFork
                    onRetry={handleRetryInterruptedMessage}
                    onRewind={onRewindRequest}
                  />
                ) : null}
                {error && (
                  <ChatErrorMessage
                    error={error}
                    latestUserMessageId={getLatestMessageId({
                      messages,
                      role: "user",
                    })}
                    canFork
                    onRetry={
                      rewindToMessage ? handleRetryFailedMessage : undefined
                    }
                    onRewind={onRewindRequest}
                  />
                )}
              </div>
            </div>
          </div>
        </ChatScrollContext.Provider>
        <div className="chat__input">
          {!hasAcknowledgedConsent ? (
            <PromptInput status={status} isDisabled mode="elicitation">
              <AgentConsentGate />
            </PromptInput>
          ) : rewindRequest ? (
            <PromptInput status={status} isDisabled mode="elicitation">
              <MessageRewindConfirmation
                mode={rewindRequest.mode}
                role={rewindRequest.role}
                onConfirm={handleConfirmRewind}
                onCancel={() => setRewindRequest(null)}
              />
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
            <AgentChatInput
              status={status}
              value={draftInput}
              onValueChange={setSessionDraftInput}
              onSubmit={({ text, requestedSkills, commandNames }) => {
                if (commandNames.length > 0) {
                  runPromptCommands(
                    { commandNames, text, requestedSkills },
                    {
                      compactSession,
                      startNewSession: () => {
                        setActiveSession(DRAFT_SESSION_ID);
                        return DRAFT_SESSION_ID;
                      },
                      setPendingMessage: store.getState().setPendingMessage,
                    }
                  );
                  return;
                }
                // Command tokens are stripped before this point, so a
                // commands-only submit has nothing left to send.
                if (!text) {
                  return;
                }
                void scrollToBottom();
                sendMessage(
                  { text },
                  requestedSkills.length > 0
                    ? { body: { requestedSkills } }
                    : undefined
                );
              }}
              textareaRef={textareaRef}
              modelMenuValue={modelMenuValue}
              onModelChange={onModelChange}
              isInputDisabled={isCompacting}
              isSubmitDisabled={isSubmitDisabled}
              onStop={() => {
                void stop();
              }}
            />
          )}
          {canToggleEditPermission || children || canToggleTemporaryChat ? (
            <div className="chat__input-meta">
              {canToggleEditPermission ? (
                <div className="chat__edit-permissions">
                  <AgentEditPermissionMenu />
                </div>
              ) : null}
              {children ? (
                <div className="chat__children">{children}</div>
              ) : null}
              {canToggleTemporaryChat ? (
                <TemporaryChatToggle
                  isTemporary={isDraftSessionTemporary}
                  onToggle={() =>
                    setIsDraftSessionTemporary(!isDraftSessionTemporary)
                  }
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </ElicitationDraftProvider>
  );
}

const loadingCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

/** Loading affordance shown while the assistant response is pending. */
function Loading() {
  return (
    <div css={loadingCSS}>
      <PxiGlyph animation="wave-hold" size={12} />
      <Shimmer size="S" color="text-500" fontStyle="italic">
        Thinking...
      </Shimmer>
    </div>
  );
}
