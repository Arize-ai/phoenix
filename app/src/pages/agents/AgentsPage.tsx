import { useChat } from "@ai-sdk/react";
import { css } from "@emotion/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { z } from "zod";

import { authFetch } from "@phoenix/authFetch";
import { PageHeader, View } from "@phoenix/components";
import { MessageBar } from "@phoenix/components/chat";
import type { GenerativeProviderKey } from "@phoenix/components/generative/__generated__/ModelMenuQuery.graphql";
import {
  ModelMenu,
  type ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import { prependBasename } from "@phoenix/utils/routingUtils";

export const AGENT_MODEL_LOCAL_STORAGE_KEY = "arize-phoenix-agent-config";

export type AgentModelConfig = z.infer<typeof AGENT_MODEL_CONFIG_SCHEMA>;

export function AgentsPage() {
  const [menuValue, setMenuValue] = useState<ModelMenuValue>(() => {
    const config = getAgentModelConfigFromLocalStorage();
    return config ? toModelMenuValue(config) : DEFAULT_MODEL_MENU_VALUE;
  });

  const chatApiUrl = prependBasename(
    menuValue.customProvider
      ? `/vercel_chat_stream?provider_type=custom&provider_id=${encodeURIComponent(menuValue.customProvider.id)}&model_name=${encodeURIComponent(menuValue.modelName)}`
      : `/vercel_chat_stream?provider_type=builtin&provider=${encodeURIComponent(menuValue.provider)}&model_name=${encodeURIComponent(menuValue.modelName)}`
  );

  const handleChange = (model: ModelMenuValue) => {
    setMenuValue(model);
    localStorage.setItem(
      AGENT_MODEL_LOCAL_STORAGE_KEY,
      JSON.stringify(toAgentModelConfig(model))
    );
  };

  return (
    <>
      <View borderBottomColor="dark" borderBottomWidth="thin">
        <PageHeader
          title="Pixi"
          extra={<ModelMenu value={menuValue} onChange={handleChange} />}
        />
      </View>
      <Chat key={chatApiUrl} chatApiUrl={chatApiUrl} />
    </>
  );
}

const chatCSS = css`
  position: relative;
  flex: 1;
  min-height: 0;

  .chat__scroll {
    height: 100%;
    overflow-y: auto;
  }

  .chat__messages {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    padding-bottom: var(--global-dimension-size-1200);
  }

  .chat__input {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    background-color: var(--global-color-gray-75);
  }

  .chat__user-message {
    align-self: flex-end;
    background-color: var(--global-color-primary-700);
    color: var(--global-color-gray-50);
    border-radius: var(--global-rounding-large) var(--global-rounding-large) 0
      var(--global-rounding-large);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    max-width: 75%;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    word-wrap: break-word;
  }

  .chat__assistant-message {
    align-self: flex-start;
    max-width: 90%;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__empty {
    text-align: center;
    margin-top: var(--global-dimension-size-400);
    color: var(--global-text-color-300);
    font-size: var(--global-font-size-s);
  }

  .chat__loading {
    color: var(--global-text-color-300);
    font-size: var(--global-font-size-s);
  }
`;

function Chat({ chatApiUrl }: { chatApiUrl: string }) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: chatApiUrl, fetch: authFetch }),
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div css={chatCSS}>
      <div className="chat__scroll">
        <div className="chat__messages">
          {messages.length === 0 && <EmptyState />}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} parts={m.parts} />
            ) : (
              <AssistantMessage key={m.id} parts={m.parts} />
            )
          )}
          {status === "submitted" && <Loading />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat__input">
        <MessageBar
          onSendMessage={(text) => sendMessage({ text })}
          isSending={status === "submitted" || status === "streaming"}
          placeholder="Send a message…"
        />
      </div>
    </div>
  );
}

function UserMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div className="chat__user-message">
      {parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("")}
    </div>
  );
}

function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div className="chat__assistant-message">
      {parts.map((part, i) =>
        isTextUIPart(part) ? <Streamdown key={i}>{part.text}</Streamdown> : null
      )}
    </div>
  );
}

function Loading() {
  return <p className="chat__loading">...</p>;
}

function EmptyState() {
  return <p className="chat__empty">Send a message to chat with Pixi</p>;
}

const DEFAULT_MODEL_MENU_VALUE: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-4.6-opus",
};

const GENERATIVE_PROVIDER_KEY_SCHEMA = z.enum([
  "ANTHROPIC",
  "AWS",
  "AZURE_OPENAI",
  "DEEPSEEK",
  "GOOGLE",
  "OLLAMA",
  "OPENAI",
  "XAI",
]) satisfies z.ZodType<GenerativeProviderKey>;

const AGENT_MODEL_CONFIG_SCHEMA = z.object({
  provider: GENERATIVE_PROVIDER_KEY_SCHEMA,
  model: z.string(),
  customProviderId: z.string().optional(),
});

/**
 * Converts a {@link ModelMenuValue} to the shape persisted in localStorage.
 */
function toAgentModelConfig(model: ModelMenuValue): AgentModelConfig {
  return {
    provider: model.provider,
    model: model.modelName,
    customProviderId: model.customProvider?.id,
  };
}

/**
 * Converts a persisted {@link AgentModelConfig} back into a {@link ModelMenuValue}
 * for the model selector UI.
 */
function toModelMenuValue(config: AgentModelConfig): ModelMenuValue {
  return {
    provider: config.provider,
    modelName: config.model,
    ...(config.customProviderId && {
      customProvider: { id: config.customProviderId, name: "" },
    }),
  };
}

/**
 * Reads and validates the saved agent model config from localStorage.
 * Returns `null` if nothing is stored or the value fails validation.
 */
export function getAgentModelConfigFromLocalStorage(): AgentModelConfig | null {
  try {
    const raw = localStorage.getItem(AGENT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return AGENT_MODEL_CONFIG_SCHEMA.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
