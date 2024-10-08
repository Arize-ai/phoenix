import { ChatMessageRole } from "@phoenix/store";

export const NUM_MAX_PLAYGROUND_INSTANCES = 2;

export const DEFAULT_CHAT_ROLE = "user";

/**
 * Map of a string role to a ChatMessageRole.
 * Attempts
 */
export const ChatRoleMap: Record<ChatMessageRole, string[]> = {
  user: ["user", "human"],
  ai: ["assistant", "bot", "ai"],
  system: ["system"],
  tool: ["tool"],
};
