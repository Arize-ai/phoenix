import { useChat } from "@ai-sdk/react";
import { css } from "@emotion/react";
import { defineCatalog } from "@json-render/core";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
  defineRegistry,
  schema,
} from "@json-render/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
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
    if (!raw) return null;
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

export function AgentsPage() {
  const [menuValue, setMenuValue] = useState<ModelMenuValue>(() => {
    const config = getAgentModelConfigFromLocalStorage();
    return config
      ? toModelMenuValue(config)
      : { provider: "ANTHROPIC", modelName: "claude-4.6-opus" };
  });

  const chatApiUrl = menuValue.customProvider
    ? `/vercel_chat_stream?provider_type=custom&provider_id=${encodeURIComponent(menuValue.customProvider.id)}&model_name=${encodeURIComponent(menuValue.modelName)}`
    : `/vercel_chat_stream?provider_type=builtin&provider=${encodeURIComponent(menuValue.provider)}&model_name=${encodeURIComponent(menuValue.modelName)}`;

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

type ClarifyingQuestion = { question: string; choices: string[] };

type PendingClarification = {
  toolCallId: string;
  questions: ClarifyingQuestion[];
};

const SYSTEM_PROMPT =
  "You are a helpful AI assistant. When a user's request is ambiguous or " +
  "unclear, use the ask_clarification_questions tool to ask follow-up " +
  "questions before proceeding. Provide 2-3 possible answers for each " +
  "question. Ask all questions at once in a single tool call.";

const AGENT_TOOLS = [
  {
    name: "ask_clarification_questions",
    description:
      "Ask the user clarifying questions when their request is ambiguous. " +
      "Each question must include 2-3 suggested answers.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "List of clarifying questions to ask.",
          items: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "The clarifying question.",
              },
              choices: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 3,
                description: "2-3 possible answers the user can choose from.",
              },
            },
            required: ["question", "choices"],
          },
          minItems: 1,
        },
      },
      required: ["questions"],
    },
  },
];

function getTextContent(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
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

interface AgentChatProps {
  chatApiUrl: string;
}

function AgentChat({ chatApiUrl }: AgentChatProps) {
  const [pendingClarification, setPendingClarification] =
    useState<PendingClarification | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const answersRef = useRef<string[]>([]);

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport: new DefaultChatTransport({ api: chatApiUrl, fetch: authFetch }),

    onToolCall: ({ toolCall }) => {
      if (
        toolCall.toolName === "ask_clarification_questions" &&
        toolCall.dynamic
      ) {
        const input = toolCall.input as { questions: ClarifyingQuestion[] };
        setPendingClarification({
          toolCallId: toolCall.toolCallId,
          questions: input.questions,
        });
        setCurrentQuestionIndex(0);
        answersRef.current = [];
      }
    },

    sendAutomaticallyWhen: ({ messages: msgs }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages: msgs }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingClarification]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!pendingClarification) return;

      const newAnswers = [...answersRef.current, answer];
      answersRef.current = newAnswers;

      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex < pendingClarification.questions.length) {
        setCurrentQuestionIndex(nextIndex);
      } else {
        const result = pendingClarification.questions.map((q, i) => ({
          question: q.question,
          answer: newAnswers[i],
        }));

        const { toolCallId } = pendingClarification;
        setPendingClarification(null);
        setCurrentQuestionIndex(0);
        answersRef.current = [];

        // addToolOutput is typed for static tools; the `tool` param is unused
        // at runtime so casting is safe for dynamic tool calls.
        void (
          addToolOutput as unknown as (args: {
            toolCallId: string;
            output: unknown;
          }) => Promise<void>
        )({
          toolCallId,
          output: result,
        });
      }
    },
    [pendingClarification, currentQuestionIndex, addToolOutput]
  );

  const currentQuestion = pendingClarification?.questions[currentQuestionIndex];

  return (
    <div css={agentChatCSS}>
      <div className="chat__messages">
        {messages.length === 0 && !pendingClarification && (
          <p className="chat__empty">Send a message to start chatting.</p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="chat__user-message">
              {getTextContent(m.parts as { type: string; text?: string }[])}
            </div>
          ) : (
            <div key={m.id} className="chat__assistant-message">
              {(m.parts as { type: string; text?: string }[]).map((part, i) =>
                part.type === "text" ? (
                  <Streamdown key={i}>{part.text ?? ""}</Streamdown>
                ) : null
              )}
            </div>
          )
        )}
        {currentQuestion && (
          <div key={currentQuestionIndex}>
            <StateProvider>
              <VisibilityProvider>
                <ActionProvider handlers={{}}>
                  <Renderer
                    registry={agentChatRegistry}
                    spec={{
                      root: "choices",
                      elements: {
                        choices: {
                          type: "Choices",
                          props: {
                            question: currentQuestion.question,
                            options: currentQuestion.choices,
                            onAnswer: handleAnswer,
                            currentIndex: currentQuestionIndex,
                            totalCount: pendingClarification.questions.length,
                          },
                          children: [],
                        },
                      },
                    }}
                  />
                </ActionProvider>
              </VisibilityProvider>
            </StateProvider>
          </div>
        )}
        {isLoading &&
          messages.at(-1)?.role !== "assistant" &&
          !pendingClarification && <p className="chat__loading">...</p>}
        <div ref={bottomRef} />
      </div>
      <MessageBar
        onSendMessage={(text) =>
          sendMessage(
            { text },
            { body: { system: SYSTEM_PROMPT, tools: AGENT_TOOLS } }
          )
        }
        isSending={isLoading || pendingClarification !== null}
        placeholder="Send a message…"
      />
    </div>
  );
}

const agentChatCatalog = defineCatalog(schema, {
  components: {
    Choices: {
      props: z.object({
        question: z.string(),
        options: z.array(z.string()),
        /**
         * Called with the selected or typed answer when the user submits.
         * Passed as a function reference in the spec (not JSON-serializable),
         * so this component is always constructed programmatically in TypeScript.
         */
        onAnswer: z.custom<(answer: string) => void>(
          (v) => typeof v === "function"
        ),
        currentIndex: z.number(),
        totalCount: z.number(),
      }),
      description:
        "Displays a clarifying question with 2-3 selectable answer options. Always includes a 'No, but…' fallback for a custom typed answer.",
    },
  },
  actions: {},
});

const choicesCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  align-self: flex-start;
  width: fit-content;
  max-width: 360px;
  background: var(--global-background-color-800);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-large);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);

  .choices__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
  }

  .choices__question {
    margin: 0;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-900);
  }

  .choices__progress {
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-300);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .choices__options {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    align-items: flex-start;
  }

  .choices__option,
  .choices__custom,
  .choices__submit {
    font-size: var(--global-font-size-s);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    border-radius: var(--global-rounding-medium);
    cursor: pointer;
    white-space: nowrap;
  }

  .choices__option {
    border: 1px solid var(--global-color-primary-500);
    background: transparent;
    color: var(--global-color-primary-500);
    &:hover {
      background: color-mix(
        in srgb,
        var(--global-color-primary-500) 10%,
        transparent
      );
    }
  }

  .choices__custom {
    border: 1px solid var(--global-border-color-default);
    background: transparent;
    color: var(--global-text-color-300);
    &:hover {
      background: color-mix(
        in srgb,
        var(--global-text-color-300) 8%,
        transparent
      );
    }
  }

  .choices__custom-form {
    display: flex;
    gap: var(--global-dimension-size-75);
    flex: 1;
    min-width: 0;
  }

  .choices__custom-input {
    flex: 1;
    min-width: 0;
    font-size: var(--global-font-size-s);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    border-radius: var(--global-rounding-medium);
    border: 1px solid var(--global-border-color-default);
    background: transparent;
    color: var(--global-text-color-900);
    outline: none;
    &:focus {
      border-color: var(--global-color-primary-500);
    }
  }

  .choices__submit {
    border: none;
    background: var(--global-color-primary-500);
    color: white;
    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
`;

const { registry: agentChatRegistry } = defineRegistry(agentChatCatalog, {
  components: {
    Choices: ({ props }) => {
      const [customMode, setCustomMode] = useState(false);
      const [customText, setCustomText] = useState("");

      return (
        <div css={choicesCSS}>
          <div className="choices__header">
            <p className="choices__question">{props.question}</p>
            {props.totalCount > 1 && (
              <span className="choices__progress">
                {props.currentIndex + 1}/{props.totalCount}
              </span>
            )}
          </div>
          <div className="choices__options">
            {props.options.map((opt) => (
              <button
                key={opt}
                className="choices__option"
                onClick={() => props.onAnswer(opt)}
              >
                {opt}
              </button>
            ))}
            {customMode ? (
              <form
                className="choices__custom-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = customText.trim();
                  if (trimmed) {
                    props.onAnswer(trimmed);
                  }
                }}
              >
                <input
                  autoFocus
                  className="choices__custom-input"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Enter your answer…"
                />
                <button
                  type="submit"
                  className="choices__submit"
                  disabled={!customText.trim()}
                >
                  Submit
                </button>
              </form>
            ) : (
              <button
                className="choices__custom"
                onClick={() => setCustomMode(true)}
              >
                Something else…
              </button>
            )}
          </div>
        </div>
      );
    },
  },
});
