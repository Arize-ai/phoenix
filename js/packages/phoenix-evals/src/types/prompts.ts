import { ModelMessage } from "ai";

/**
 * Prompt part of the AI function options for model generation.
 * It contains a system message, a simple text prompt, or a list of model messages.
 * Uses ModelMessage format compatible with AI SDK v5 generateObject function.
 */
export interface WithPrompt {
  /**
   * System message to include in the prompt. Can be used with `prompt` or `messages`.
   */
  system?: string;
  /**
   * A simple text prompt. You can either use `prompt` or `messages` but not both.
   */
  prompt?: string;
  /**
   * A list of model messages. You can either use `prompt` or `messages` but not both.
   * Uses ModelMessage format for compatibility with AI SDK v5.
   */
  messages?: Array<ModelMessage>;
}
