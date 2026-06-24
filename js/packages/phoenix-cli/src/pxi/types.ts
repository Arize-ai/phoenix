import type { ChatTransport, UIMessage } from "ai";

import type { PhoenixConfig } from "../config";

export type AssistantMessageMetadata = {
  sessionId: string;
  trace?: {
    traceId: string;
    rootSpanId: string;
  } | null;
  usage?: {
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    promptDetails?: {
      cacheRead: number;
      cacheWrite: number;
    } | null;
  } | null;
};

export type PxiMessage = UIMessage<AssistantMessageMetadata>;

export type BuiltInProvider =
  | "ANTHROPIC"
  | "AWS"
  | "AZURE_OPENAI"
  | "CEREBRAS"
  | "DEEPSEEK"
  | "FIREWORKS"
  | "GOOGLE"
  | "GROQ"
  | "MOONSHOT"
  | "OLLAMA"
  | "OPENAI"
  | "PERPLEXITY"
  | "TOGETHER"
  | "XAI";

export type ModelSelection =
  | {
      providerType: "builtin";
      provider: BuiltInProvider;
      modelName: string;
    }
  | {
      providerType: "custom";
      providerId: string;
      modelName: string;
    };

export type PxiContext =
  | {
      type: "app";
      currentDateTime: string;
      timeZone: string;
    }
  | {
      type: "graphql";
      mutationsEnabled: boolean;
    }
  | {
      type: "web_access";
      enabled: boolean;
    }
  | {
      type: "subagents";
      enabled: boolean;
    };

export type PxiEditPermission = "manual" | "bypass";

export type PxiChatRequest = {
  id: string;
  messages: PxiMessage[];
  trigger: "submit-message";
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
  editPermission: PxiEditPermission;
  contexts: PxiContext[];
  model: ModelSelection;
};

export type PxiRuntimeOptions = {
  sessionId: string;
  config: PhoenixConfig;
  modelSelection: ModelSelection;
  enableWebAccess: boolean;
  enableSubagents: boolean;
  enableGraphqlMutations: boolean;
  editPermission: PxiEditPermission;
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
};

export type PxiChatClient = {
  sendMessage: (options: {
    messages: PxiMessage[];
    abortSignal?: AbortSignal;
    onAssistantMessage: (message: PxiMessage) => void;
  }) => Promise<PxiMessage | null>;
};

export type PxiTransport = ChatTransport<PxiMessage>;
