import {
  ChatMessageRole,
  chatMessageRoles,
} from "@phoenix/store/playgroundStore";

/**
 * Checks if a string is a valid chat message role
 */
export function isChatMessageRole(role: unknown): role is ChatMessageRole {
  return chatMessageRoles.includes(role as ChatMessageRole);
}
