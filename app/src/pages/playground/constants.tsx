export const NUM_MAX_PLAYGROUND_INSTANCES = 4;

export const DEFAULT_CHAT_ROLE = "user";

/**
 * Map of {@link ChatMessageRole} to potential role values.
 * Used to map roles to a canonical role.
 */
export const ChatRoleMap: Record<ChatMessageRole, string[]> = {
  user: ["user", "human"],
  ai: ["assistant", "bot", "ai"],
  system: ["system"],
  tool: ["tool"],
};
