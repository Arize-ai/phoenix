import { css, keyframes } from "@emotion/react";
import { Suspense, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
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
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageCopyAction,
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
import { ChatTokenUsage } from "@phoenix/components/ai/token-usage";
import {
  BROWSER_AI_MENU_ITEM_ID,
  getBrowserBuiltInModel,
  useBrowserAIMenuItem,
} from "@phoenix/components/generative/browserAI";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { isProviderProvisioned } from "@phoenix/components/generative/modelProviderUtils";
import { useModelMenuData } from "@phoenix/components/generative/useModelMenuData";
import { compactResizeHandleCSS } from "@phoenix/components/resize";

import type { ChatModelSelection } from "./chatModel";
import { getStoredChatModel, storeChatModel } from "./chatModelStorage";
import type { ChatParameters } from "./chatParameters";
import { ChatParametersSidebar } from "./ChatParametersSidebar";
import {
  getStoredChatParameters,
  storeChatParameters,
} from "./chatParametersStorage";
import type { DirectChatMessage } from "./useDirectChat";
import { useDirectChat } from "./useDirectChat";

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
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  .chat-page__conversation {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* A slim header bar (like the PXI chat panel's) reserving the top-right
     corner for conversation actions; always rendered so the layout doesn't
     jump when the first message makes the New Chat button appear. */
  .chat-page__header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: var(--global-dimension-size-450);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    box-sizing: border-box;
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
    padding: var(--global-dimension-size-100) 0;
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
 * tools, or persistence in between.
 */
export function ChatPage() {
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
 * which still needs a base URL on the server), then Browser AI when this
 * browser has a built-in model (it works with zero setup), then anything
 * installed as a last resort.
 */
function getDefaultModel({
  availableBuiltinModels,
  availableCustomModels,
  visibleProviders,
  hasBrowserAI,
}: Pick<
  ReturnType<typeof useModelMenuData>,
  "availableBuiltinModels" | "availableCustomModels" | "visibleProviders"
> & { hasBrowserAI: boolean }): ChatModelSelection | null {
  const toSelection = (model: {
    provider: ModelMenuValue["provider"];
    modelName: string;
  }): ChatModelSelection => ({
    kind: "server",
    model: { provider: model.provider, modelName: model.modelName },
  });

  // Empty local credentials matches this surface's server-only execution
  // path — only server-side keys count as provisioned here.
  const provisionedProviderKeys = new Set<string>(
    visibleProviders
      .filter(
        (provider) =>
          provider.dependenciesInstalled &&
          isProviderProvisioned({ provider, localCredentials: {} })
      )
      .map((provider) => provider.key)
  );
  const provisionedBuiltin = availableBuiltinModels.find((model) =>
    provisionedProviderKeys.has(model.provider)
  );
  if (provisionedBuiltin) {
    return toSelection(provisionedBuiltin);
  }

  const custom = availableCustomModels[0];
  if (custom) {
    return {
      kind: "server",
      model: {
        provider: custom.provider,
        modelName: custom.modelName,
        customProvider: {
          id: custom.customProviderId,
          name: custom.customProviderName,
        },
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
    return toSelection(readyBuiltin);
  }

  // Browser AI answers with zero configuration, unlike the fallback below —
  // an installed provider with no credentials will only error at send time.
  if (hasBrowserAI) {
    return { kind: "browser" };
  }

  const builtin = availableBuiltinModels[0];
  return builtin ? toSelection(builtin) : null;
}

function ChatSurface() {
  // Chat sends through the server's chat-completions proxy, which
  // authenticates with server-side credentials only — browser-local keys
  // must not make a provider look usable here (unlike the playground).
  // store-or-network reuses the response of the child ModelMenu's identical
  // query instead of issuing a duplicate fetch.
  const { availableBuiltinModels, availableCustomModels, visibleProviders } =
    useModelMenuData({
      credentialSource: "server",
      fetchPolicy: "store-or-network",
    });
  const browserAIItem = useBrowserAIMenuItem();
  const [selectedModel, setSelectedModel] = useState<ChatModelSelection | null>(
    getStoredChatModel
  );
  const [parameters, setParameters] = useState<ChatParameters>(
    getStoredChatParameters
  );
  // The send path reads parameters through a ref so the submit/regenerate
  // handlers keep a stable identity while the user drags a slider — otherwise
  // every parameter tick would re-render the whole message list.
  const parametersRef = useRef(parameters);
  const model =
    selectedModel ??
    getDefaultModel({
      availableBuiltinModels,
      availableCustomModels,
      visibleProviders,
      hasBrowserAI: browserAIItem !== null,
    });

  const {
    messages,
    status,
    error,
    usage,
    downloadProgress,
    sendMessage,
    retry,
    stop,
    clear,
  } = useDirectChat();
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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "chat-page-panels",
    panelIds: ["chat-parameters", "chat-conversation"],
    storage: localStorage,
  });

  const showsEmptyState = messages.length === 0;
  const hasChatSettled = status === "ready" || status === "error";
  const modelDisplayName =
    model?.kind === "browser"
      ? (getBrowserBuiltInModel()?.modelName ?? "Browser AI")
      : model?.model.modelName;

  const handleModelChange = (nextModel: ChatModelSelection) => {
    setSelectedModel(nextModel);
    storeChatModel(nextModel);
  };

  const handleParametersChange = (nextParameters: ChatParameters) => {
    parametersRef.current = nextParameters;
    setParameters(nextParameters);
    storeChatParameters(nextParameters);
  };

  const handleSubmit = (text: string) => {
    if (!model) {
      // Unreachable: the composer and submit are disabled without a model.
      return;
    }
    void scrollToBottom();
    sendMessage(text, model, parametersRef.current);
  };

  const handleRegenerate = () => {
    if (model) {
      retry(model, parametersRef.current);
    }
  };

  return (
    <main
      css={chatPageCSS}
      className={showsEmptyState ? "chat-page chat-page--empty" : "chat-page"}
    >
      <Group
        id="chat-page-panels"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="chat-parameters"
          defaultSize="340px"
          minSize="260px"
          maxSize="480px"
        >
          <ChatParametersSidebar
            parameters={parameters}
            onChange={handleParametersChange}
          />
        </Panel>
        <Separator css={compactResizeHandleCSS} />
        <Panel id="chat-conversation" className="chat-page__conversation">
          <div className="chat-page__header">
            {!showsEmptyState && (
              <TooltipTrigger>
                <IconButton size="S" aria-label="New chat" onPress={clear}>
                  <Icon svg={<Icons.MessageCirclePlus />} />
                </IconButton>
                <Tooltip>New chat</Tooltip>
              </TooltipTrigger>
            )}
          </div>
          <div className="chat-page__scroll" ref={scrollRef}>
            <div className="chat-page__messages" ref={contentRef}>
              {showsEmptyState && <ChatEmptyHero model={model} />}
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
                    {downloadProgress != null
                      ? `Downloading the on-device model… ${Math.round(downloadProgress * 100)}%`
                      : "Thinking..."}
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
                      ? `Message ${modelDisplayName}...`
                      : "Configure a model provider to start chatting"
                  }
                  aria-label="Chat message"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <ModelMenu
                    value={model?.kind === "server" ? model.model : null}
                    onChange={(nextModel) =>
                      handleModelChange({ kind: "server", model: nextModel })
                    }
                    placement="top start"
                    shouldFlip
                    variant="quiet"
                    credentialSource="server"
                    leadingItems={browserAIItem ? [browserAIItem] : undefined}
                    selectedLeadingItemId={
                      model?.kind === "browser"
                        ? BROWSER_AI_MENU_ITEM_ID
                        : undefined
                    }
                    onLeadingItemSelect={() =>
                      handleModelChange({ kind: "browser" })
                    }
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
        </Panel>
      </Group>
    </main>
  );
}

function ChatEmptyHero({ model }: { model: ChatModelSelection | null }) {
  const browserName = getBrowserBuiltInModel()?.browserName;
  return (
    <div className="chat-page__empty">
      <div className="chat-page__empty-glyph">
        <Icon svg={<Icons.MessageCircle />} />
      </div>
      <h1 className="chat-page__empty-title">Chat with your models</h1>
      <p className="chat-page__empty-subtext">
        {model == null
          ? "No models are available yet. Configure a model provider in settings, then come back to start chatting."
          : model.kind === "browser"
            ? `Messages run on-device with ${browserName ?? "your browser"}'s built-in model and never leave this device. Conversations aren't saved when you leave.`
            : "Messages go straight to the model through your configured providers. Conversations aren't saved when you leave."}
      </p>
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
