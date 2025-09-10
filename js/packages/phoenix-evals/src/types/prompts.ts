import type { Prompt } from "ai";
/**
 * Prompt part of the AI function options for model generation.
 * It contains a system message, a simple text prompt, or a list of model messages.
 * Uses ModelMessage format compatible with AI SDK v5 generateObject function.
 */
export type WithPrompt = Prompt;
