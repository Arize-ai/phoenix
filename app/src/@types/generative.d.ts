declare type ModelProvider = "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC";

/**
 * The role of a chat message
 */
declare type ChatMessageRole = "user" | "system" | "ai" | "tool";

/**
 * The tool picking mechanism for an LLM
 */
declare type ToolChoice = "auto" | "required" | "none";
