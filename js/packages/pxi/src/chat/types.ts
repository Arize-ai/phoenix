import type { componentsV1 } from "@arizeai/phoenix-client";
import type { UIMessage } from "ai";

/**
 * UI message exchanged with the Phoenix server agent. The server speaks the
 * Vercel AI SDK UI-message format, so the AI SDK {@link UIMessage} is the
 * wire-compatible shape for both the request history and the streamed reply.
 */
export type AgentUIMessage = UIMessage;

/** Discriminated union of chat request payloads accepted by the endpoint. */
export type ChatRequestBody = componentsV1["schemas"]["ChatRequest"];

/** The `submit-message` branch of {@link ChatRequestBody}. */
export type ChatSubmitMessage = componentsV1["schemas"]["ChatSubmitMessage"];

/** The `regenerate-message` branch of {@link ChatRequestBody}. */
export type ChatRegenerateMessage =
  componentsV1["schemas"]["ChatRegenerateMessage"];

/** Provider + model selection for a turn (built-in or custom provider). */
export type ModelSelection = ChatSubmitMessage["model"];

/** Built-in model provider enum (e.g. "ANTHROPIC", "OPENAI"). */
export type ModelProvider = componentsV1["schemas"]["ModelProvider"];

/** Typed UI-state context the server agent understands. */
export type ChatContext = componentsV1["schemas"]["ChatContext"];
