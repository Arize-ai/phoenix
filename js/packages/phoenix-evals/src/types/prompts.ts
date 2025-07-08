import { CoreMessage, Message } from "ai";

/**
 * Prompt part of the AI function options.
 * It contains a system message, a simple text prompt, or a list of messages.
 * Note: this is pulled from the `ai` package and is used as a compatibility type.
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
   * A list of messages. You can either use `prompt` or `messages` but not both.
   */
  messages?: Array<CoreMessage> | Array<Omit<Message, "id">>;
}
