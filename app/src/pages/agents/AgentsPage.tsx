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

const generativeProviderKeySchema = z.enum([
  "ANTHROPIC",
  "AWS",
  "AZURE_OPENAI",
  "DEEPSEEK",
  "GOOGLE",
  "OLLAMA",
  "OPENAI",
  "XAI",
]) satisfies z.ZodType<GenerativeProviderKey>;

const agentModelConfigSchema = z.object({
  provider: generativeProviderKeySchema,
  model: z.string(),
  customProviderId: z.string().optional(),
});

export type AgentModelConfig = z.infer<typeof agentModelConfigSchema>;

function toAgentModelConfig(model: ModelMenuValue): AgentModelConfig {
  return {
    provider: model.provider,
    model: model.modelName,
    customProviderId: model.customProvider?.id,
  };
}

function toModelMenuValue(config: AgentModelConfig): ModelMenuValue {
  return {
    provider: config.provider,
    modelName: config.model,
    ...(config.customProviderId && {
      customProvider: { id: config.customProviderId, name: "" },
    }),
  };
}

export function getAgentModelConfigFromLocalStorage(): AgentModelConfig | null {
  try {
    const raw = localStorage.getItem(AGENT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return agentModelConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

const agentsPageCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const DEFAULT_MODEL_MENU_VALUE: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-4.6-opus",
};

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
    <div css={agentsPageCSS}>
      <View borderBottomColor="dark" borderBottomWidth="thin">
        <PageHeader
          title="Pixi"
          extra={<ModelMenu value={menuValue} onChange={handleChange} />}
        />
      </View>
      <AgentChat key={chatApiUrl} chatApiUrl={chatApiUrl} />
    </div>
  );
}

const agentChatCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;

  .chat__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    min-height: 0;
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

function Loading() {
  return <p className="chat__loading">...</p>;
}

function EmptyState() {
  return <p className="chat__empty">Send a message to chat with Pixi</p>;
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

function AgentChat({ chatApiUrl }: { chatApiUrl: string }) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: chatApiUrl, fetch: authFetch }),
  });

  const assistantMessageInProgress =
    status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantMessageInProgress]);

  return (
    <div css={agentChatCSS}>
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
      <View paddingX="size-100" paddingY="size-100">
        <MessageBar
          onSendMessage={(text) => sendMessage({ text })}
          isSending={assistantMessageInProgress}
          placeholder="Send a message…"
        />
      </View>
    </div>
  );
}
