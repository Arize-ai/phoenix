import { css } from "@emotion/react";
import { useStickToBottom } from "use-stick-to-bottom";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@phoenix/components/ai/prompt-input";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  ChatEmptyState,
  ChatMessages,
  ChatStatusMessage,
} from "@phoenix/pages/chat/ChatConversation";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import { VariableEditor } from "@phoenix/pages/playground/VariableEditor";

import type { usePromptPlaygroundChat } from "./usePromptPlaygroundChat";

export const PROMPT_CHAT_MIN_WIDTH = 360;

/**
 * The widest the chat grows, matching its composer's widest
 */
export const PROMPT_CHAT_MAX_WIDTH = 780;

const promptChatCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  .prompt-chat__header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: var(--global-dimension-size-450);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    box-sizing: border-box;
  }

  .prompt-chat__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .prompt-chat__messages {
    box-sizing: border-box;
    width: 100%;
    max-width: ${PROMPT_CHAT_MAX_WIDTH}px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  &.prompt-chat--empty {
    .prompt-chat__messages {
      min-height: 100%;
    }

    .chat-empty-state {
      margin-block: auto;
    }
  }

  .prompt-chat__input {
    flex-shrink: 0;
    box-sizing: border-box;
    width: 100%;
    max-width: ${PROMPT_CHAT_MAX_WIDTH}px;
    margin: 0 auto;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200)
      var(--global-dimension-size-200);
  }

  .prompt-chat__variables [slot="trigger"] {
    border-top: var(--global-border-size-thin) solid
      var(--global-disclosure-border-color);
    border-bottom: none;
    padding: var(--global-dimension-size-125) var(--global-dimension-size-150);
  }

  .prompt-chat__variables-summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-chat__variables:not([data-expanded]) [slot="trigger"] {
    border-end-start-radius: var(--prompt-input-border-radius);
    border-end-end-radius: var(--prompt-input-border-radius);
  }

  .prompt-chat__variables-panel {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
    max-height: 40vh;
    overflow-y: auto;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-200)
      var(--global-dimension-size-250);
  }
`;

/**
 * A conversation with the prompt as it is being edited beside it
 */
export function PromptChat({
  instanceId,
  chat,
}: {
  instanceId: number;
  chat: ReturnType<typeof usePromptPlaygroundChat>;
}) {
  const modelName = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
        .modelName
  );
  const {
    draft,
    setDraft,
    messages,
    status,
    error,
    sendMessage,
    retry,
    stop,
    clear,
  } = chat;
  const { variableKeys } = useDerivedPlaygroundVariables();
  const showsEmptyState = messages.length === 0;
  const { contentRef, scrollRef, scrollToBottom } = useStickToBottom({
    initial: "instant",
    resize: "instant",
  });

  const handleSubmit = (text: string) => {
    void scrollToBottom();
    sendMessage(text);
  };

  return (
    <section
      css={promptChatCSS}
      className={
        showsEmptyState ? "prompt-chat prompt-chat--empty" : "prompt-chat"
      }
      aria-label="Chat with your prompt"
    >
      <div className="prompt-chat__header">
        {!showsEmptyState ? (
          <TooltipTrigger>
            <IconButton size="S" aria-label="New chat" onPress={clear}>
              <Icon svg={<Icons.MessageCirclePlus />} />
            </IconButton>
            <Tooltip>New chat</Tooltip>
          </TooltipTrigger>
        ) : null}
      </div>
      <div className="prompt-chat__scroll" ref={scrollRef}>
        <div className="prompt-chat__messages" ref={contentRef}>
          {showsEmptyState ? (
            <ChatEmptyState title="Chat with your prompt" headingLevel={2}>
              Messages run against the prompt as you edit it, with its model,
              parameters, and tools. Conversations aren&apos;t saved when you
              leave.
            </ChatEmptyState>
          ) : null}
          <ChatMessages
            messages={messages}
            status={status}
            onRegenerate={retry}
          />
          <ChatStatusMessage
            status={status}
            downloadProgress={null}
            error={error}
            canRetry
            onRetry={retry}
          />
        </div>
      </div>
      <div className="prompt-chat__input">
        <PromptInput
          onSubmit={handleSubmit}
          status={status}
          value={draft}
          onValueChange={setDraft}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={modelName ? `Message ${modelName}...` : "Message..."}
              aria-label="Chat message"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputActions>
              <PromptInputSubmit onPress={stop} />
            </PromptInputActions>
          </PromptInputFooter>
          {variableKeys.length > 0 ? (
            <PromptChatVariables variableKeys={variableKeys} />
          ) : null}
        </PromptInput>
      </div>
    </section>
  );
}

/**
 * The prompt's variables, unfolding beneath the message they are sent with
 */
function PromptChatVariables({ variableKeys }: { variableKeys: string[] }) {
  const { variablesMap } = useDerivedPlaygroundVariables();
  const setVariableValue = usePlaygroundContext(
    (state) => state.setVariableValue
  );
  const emptyCount = variableKeys.filter(
    (variableKey) => !variablesMap[variableKey]
  ).length;
  return (
    <Disclosure
      className="prompt-chat__variables"
      defaultExpanded={emptyCount > 0}
    >
      <DisclosureTrigger arrowPosition="start" justifyContent="space-between">
        <Text>Variables</Text>
        <Text
          className="prompt-chat__variables-summary"
          size="XS"
          color="text-500"
        >
          {variableKeys.join(", ")}
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <div className="prompt-chat__variables-panel">
          {variableKeys.map((variableKey, index) => (
            <VariableEditor
              key={index}
              label={variableKey}
              defaultValue={variablesMap[variableKey] ?? ""}
              onChange={(value) => setVariableValue(variableKey, value)}
            />
          ))}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
