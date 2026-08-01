import { css, keyframes } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { Suspense, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useStickToBottom } from "use-stick-to-bottom";

import {
  Alert,
  Button,
  Icon,
  IconButton,
  Icons,
  Loading,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { ChatTokenUsage } from "@phoenix/components/agent/ChatTokenUsage";
import { MessageCopyAction } from "@phoenix/components/agent/MessageCopyAction";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@phoenix/components/ai/message";
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
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { providerRequiresCredentials } from "@phoenix/components/generative/modelProviderUtils";
import { useModelMenuData } from "@phoenix/components/generative/useModelMenuData";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { getStoredChatModel, storeChatModel } from "./chatModelStorage";
import type { DirectChatMessage } from "./useDirectChat";
import { useDirectChat } from "./useDirectChat";

type StarterPrompt = {
  icon: ReactNode;
  label: string;
  prompt: string;
};

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    icon: <Icons.MessageCircle />,
    label: "Say hello",
    prompt: "Hello! Tell me a bit about yourself and what you can do.",
  },
  {
    icon: <Icons.Bulb />,
    label: "Explain a concept",
    prompt: "Explain retrieval-augmented generation and when I should use it.",
  },
  {
    icon: <Icons.Edit2 />,
    label: "Draft a system prompt",
    prompt: "Draft a concise system prompt for a customer-support AI agent.",
  },
];

const chatFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const chatEmptyFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const chatPageCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  .chat-page__toolbar {
    position: absolute;
    top: var(--global-dimension-size-100);
    right: var(--global-dimension-size-200);
    z-index: 3;
  }

  .chat-page__scroll-frame {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chat-page__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .chat-page__messages {
    box-sizing: border-box;
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-300) var(--global-dimension-size-200);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  &.chat-page--empty {
    .chat-page__messages {
      min-height: 100%;
    }

    .chat-page__empty {
      margin-block: auto;
    }
  }

  .chat-page__empty {
    width: min(100%, var(--global-dimension-size-8500));
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--global-dimension-size-150);
    color: var(--global-text-color-500);
  }

  .chat-page__empty-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-600);
    height: var(--global-dimension-size-600);
    border-radius: var(--global-rounding-full);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    background: linear-gradient(
      135deg,
      rgba(var(--global-color-gray-500-rgb), 0.18),
      rgba(var(--global-color-gray-500-rgb), 0.04)
    );
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xl);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 100ms forwards;
  }

  .chat-page__empty-title {
    margin: 0;
    font-size: var(--global-font-size-xl);
    font-weight: 600;
    color: var(--global-text-color-900);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 200ms forwards;
  }

  .chat-page__empty-subtext {
    margin: 0;
    max-width: var(--global-dimension-size-5000);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-500);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 300ms forwards;
  }

  .chat-page__starters {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-200);
  }

  .chat-page__starter {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    background: transparent;
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out
      var(--chat-page-starter-delay, 400ms) forwards;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      background: var(--global-color-gray-100);
      color: var(--global-text-color-900);
    }
  }

  .chat-page__starter-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-l);
  }

  .chat-page__thinking {
    padding-block: var(--global-dimension-size-50);
  }

  /* Mirrors the PXI chat's input-meta grid: the usage summary sits right-
     aligned in the second column and its expanded breakdown spans the row
     below. */
  .chat-page__input-meta {
    box-sizing: border-box;
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: var(--global-dimension-size-100);
    padding-top: var(--global-dimension-size-50);
  }

  .chat-page__input {
    flex-shrink: 0;
    margin: 0 auto;
    position: relative;
    z-index: 2;
    width: min(
      var(--global-dimension-size-8500),
      max(0px, calc(100% - (2 * var(--global-dimension-size-200))))
    );
    padding-top: var(--global-dimension-size-100);
    padding-bottom: var(--global-dimension-size-250);
    animation: ${chatFadeUp} 280ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-page__empty-glyph,
    .chat-page__empty-title,
    .chat-page__empty-subtext,
    .chat-page__starter,
    .chat-page__input {
      opacity: 1;
      animation: none;
      transform: none;
    }
  }
`;

/**
 * A direct line to the models configured in Phoenix: messages go straight to
 * the server's OpenAI-compatible `/v1/chat/completions` proxy with no agent,
 * tools, or persistence in between. Feature-flagged (`chat`) while
 * experimental — toggle with Ctrl+Shift+F.
 */
export function ChatPage() {
  const isChatEnabled = useFeatureFlag("chat");
  if (!isChatEnabled) {
    return <Navigate to="/" replace />;
  }
  return <EnabledChatPage />;
}

function EnabledChatPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatSurface />
    </Suspense>
  );
}

/**
 * Picks the model the chat starts on: the last-used model when one was
 * saved, otherwise the first model this deployment can actually run.
 * Preference order reflects how deliberate the configuration is:
 * providers with credentials explicitly set, then stored custom providers,
 * then zero-credential providers that merely report ready (e.g. Ollama,
 * which still needs a base URL on the server), then anything installed.
 */
function getDefaultModel({
  availableBuiltinModels,
  availableCustomModels,
  visibleProviders,
}: Pick<
  ReturnType<typeof useModelMenuData>,
  "availableBuiltinModels" | "availableCustomModels" | "visibleProviders"
>): ModelMenuValue | null {
  const toValue = (model: {
    provider: ModelMenuValue["provider"];
    modelName: string;
  }): ModelMenuValue => ({
    provider: model.provider,
    modelName: model.modelName,
  });

  // credentialsSet alone can't rank providers: it is vacuously true for
  // zero-credential providers like Ollama, which still need server-side
  // configuration (a base URL) to actually answer.
  const provisionedProviderKeys = new Set<string>(
    visibleProviders
      .filter(
        (provider) =>
          provider.dependenciesInstalled &&
          provider.credentialsSet &&
          providerRequiresCredentials({ providerKey: provider.key })
      )
      .map((provider) => provider.key)
  );
  const provisionedBuiltin = availableBuiltinModels.find((model) =>
    provisionedProviderKeys.has(model.provider)
  );
  if (provisionedBuiltin) {
    return toValue(provisionedBuiltin);
  }

  const custom = availableCustomModels[0];
  if (custom) {
    return {
      provider: custom.provider,
      modelName: custom.modelName,
      customProvider: {
        id: custom.customProviderId,
        name: custom.customProviderName,
      },
    };
  }

  const readyProviderKeys = new Set<string>(
    visibleProviders
      .filter((provider) => provider.dependenciesInstalled)
      .map((provider) => provider.key)
  );
  const readyBuiltin = availableBuiltinModels.find((model) =>
    readyProviderKeys.has(model.provider)
  );
  if (readyBuiltin) {
    return toValue(readyBuiltin);
  }

  const builtin = availableBuiltinModels[0];
  return builtin ? toValue(builtin) : null;
}

function ChatSurface() {
  const { availableBuiltinModels, availableCustomModels, visibleProviders } =
    useModelMenuData();
  const [selectedModel, setSelectedModel] = useState<ModelMenuValue | null>(
    getStoredChatModel
  );
  const model =
    selectedModel ??
    getDefaultModel({
      availableBuiltinModels,
      availableCustomModels,
      visibleProviders,
    });

  const { messages, status, error, usage, sendMessage, retry, stop, clear } =
    useDirectChat();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoFocusedRef = useRef(false);
  const handleTextareaRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    // Focus the composer once on mount so the page is ready to type into.
    // preventScroll keeps the focus from scroll-revealing the input, which
    // would cancel its transform enter animation.
    if (element && !hasAutoFocusedRef.current) {
      hasAutoFocusedRef.current = true;
      element.focus({ preventScroll: true });
    }
  };
  const { contentRef, scrollRef, scrollToBottom } = useStickToBottom({
    initial: "instant",
    resize: "instant",
  });

  const showsEmptyState = messages.length === 0;
  const hasChatSettled = status === "ready" || status === "error";

  const handleModelChange = (nextModel: ModelMenuValue) => {
    setSelectedModel(nextModel);
    storeChatModel(nextModel);
  };

  const handleSubmit = (text: string) => {
    if (!model) {
      // The composer is disabled without a model; if a submit slips through,
      // put the text back rather than dropping it.
      setDraft(text);
      return;
    }
    void scrollToBottom();
    sendMessage(text, model);
  };

  const handleStarterPrompt = (prompt: string) => {
    setDraft(prompt);
    textareaRef.current?.focus();
  };

  const handleRegenerate = () => {
    if (model) {
      retry(model);
    }
  };

  return (
    <main
      css={chatPageCSS}
      className={showsEmptyState ? "chat-page chat-page--empty" : "chat-page"}
    >
      {!showsEmptyState && (
        <div className="chat-page__toolbar">
          <TooltipTrigger>
            <IconButton size="S" aria-label="New chat" onPress={clear}>
              <Icon svg={<Icons.MessageCirclePlus />} />
            </IconButton>
            <Tooltip>New chat</Tooltip>
          </TooltipTrigger>
        </div>
      )}
      <div className="chat-page__scroll-frame">
        <div className="chat-page__scroll" ref={scrollRef}>
          <div className="chat-page__messages" ref={contentRef}>
            {showsEmptyState && (
              <ChatEmptyHero
                model={model}
                onStarterPrompt={handleStarterPrompt}
              />
            )}
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              if (message.role === "user") {
                return <ChatUserMessage key={message.id} message={message} />;
              }
              return (
                <ChatAssistantMessage
                  key={message.id}
                  message={message}
                  isStreaming={isLast && status === "streaming"}
                  showActions={!isLast || hasChatSettled}
                  pinToolbar={isLast && hasChatSettled}
                  onRegenerate={
                    isLast && hasChatSettled ? handleRegenerate : undefined
                  }
                />
              );
            })}
            {status === "submitted" && (
              <div className="chat-page__thinking">
                <Shimmer size="S" color="text-500" fontStyle="italic">
                  Thinking...
                </Shimmer>
              </div>
            )}
            {error != null && (
              <Alert
                variant="danger"
                extra={
                  model ? (
                    <Button size="S" onPress={handleRegenerate}>
                      Retry
                    </Button>
                  ) : undefined
                }
              >
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
      <div className="chat-page__input">
        <PromptInput
          onSubmit={handleSubmit}
          status={status}
          isDisabled={!model}
          value={draft}
          onValueChange={setDraft}
        >
          <PromptInputBody>
            <PromptInputTextarea
              ref={handleTextareaRef}
              placeholder={
                model
                  ? `Message ${model.modelName}...`
                  : "Configure a model provider to start chatting"
              }
              aria-label="Chat message"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelMenu
                value={model}
                onChange={handleModelChange}
                placement="top start"
                shouldFlip
                variant="quiet"
              />
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputSubmit
                isDisabled={!model || undefined}
                onPress={stop}
              />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
        {usage ? (
          <div className="chat-page__input-meta">
            <ChatTokenUsage
              total={usage.total}
              prompt={usage.prompt}
              completion={usage.completion}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ChatEmptyHero({
  model,
  onStarterPrompt,
}: {
  model: ModelMenuValue | null;
  onStarterPrompt: (prompt: string) => void;
}) {
  return (
    <div className="chat-page__empty">
      <div className="chat-page__empty-glyph">
        <Icon svg={<Icons.MessageCircle />} />
      </div>
      <h1 className="chat-page__empty-title">Chat with your models</h1>
      <p className="chat-page__empty-subtext">
        {model
          ? "Messages go straight to the model through your configured providers. Conversations aren't saved when you leave."
          : "No models are available yet. Configure a model provider in settings, then come back to start chatting."}
      </p>
      {model ? (
        <div className="chat-page__starters">
          {STARTER_PROMPTS.map((starter, index) => (
            <button
              key={starter.label}
              type="button"
              className="chat-page__starter"
              style={
                {
                  "--chat-page-starter-delay": `${400 + index * 80}ms`,
                } as CSSProperties
              }
              onClick={() => onStarterPrompt(starter.prompt)}
            >
              <span className="chat-page__starter-icon">
                <Icon svg={starter.icon} />
              </span>
              <span>{starter.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatUserMessage({ message }: { message: DirectChatMessage }) {
  return (
    <Message from="user">
      <MessageContent>{message.content}</MessageContent>
      <MessageToolbar>
        <MessageActions>
          <MessageCopyAction text={message.content} />
        </MessageActions>
      </MessageToolbar>
    </Message>
  );
}

function ChatAssistantMessage({
  message,
  isStreaming,
  showActions,
  pinToolbar,
  onRegenerate,
}: {
  message: DirectChatMessage;
  isStreaming: boolean;
  showActions: boolean;
  pinToolbar: boolean;
  onRegenerate?: () => void;
}) {
  return (
    <Message from="assistant" data-pin-toolbar={pinToolbar || undefined}>
      <MessageContent>
        <MessageResponse renderMode={isStreaming ? "streaming" : "static"}>
          {message.content}
        </MessageResponse>
      </MessageContent>
      {showActions ? (
        <MessageToolbar>
          <MessageActions>
            <MessageCopyAction text={message.content} />
            {onRegenerate ? (
              <MessageAction
                label="Regenerate"
                tooltip="Regenerate response"
                onPress={onRegenerate}
              >
                <Icon svg={<Icons.Refresh />} />
              </MessageAction>
            ) : null}
          </MessageActions>
        </MessageToolbar>
      ) : null}
    </Message>
  );
}
