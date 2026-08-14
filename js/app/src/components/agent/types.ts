/**
 * A user-facing failure from an imperative agent-chat operation (session
 * creation, compaction, rewind, branch), rendered as a dismissible banner.
 */
export type AgentChatOperationError = {
  title: string;
  message: string;
};
