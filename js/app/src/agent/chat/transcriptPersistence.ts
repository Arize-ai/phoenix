import { isResolvedClientToolOutputPart } from "./chatUtils";
import type { AgentUIMessage } from "./types";

export type TranscriptPersistenceAcknowledgement = {
  messageId: string;
};

type PersistenceState =
  | { status: "acknowledged" }
  | { status: "consumed" }
  | {
      status: "waiting";
      resolve: (hasPersistedMessage: boolean) => void;
    };

/**
 * Resolved client-tool output IDs on a message the server sent us.
 *
 * Sound only for a server-provided message — a seeded transcript — where every
 * resolved output is by definition already durable.
 */
export function resolvedClientToolOutputIds(
  message: AgentUIMessage | undefined
): string[] {
  if (message?.role !== "assistant") {
    return [];
  }
  return message.parts
    .filter(isResolvedClientToolOutputPart)
    .map((part) => part.toolCallId);
}

/**
 * Coordinates automatic continuations with durable assistant messages, and
 * tracks which client tool outputs the server already holds so the eager
 * flush never re-posts them: a redundant POST claims the session turn lock
 * and can 409 a chat continuation racing it (e.g. one carrying a mutation
 * approval), knocking the client into busy-elsewhere polling that reverts
 * the optimistic approval state.
 */
export function createTranscriptPersistenceCoordinator() {
  const persistenceByMessageId = new Map<string, PersistenceState>();
  const syncedToolOutputIds = new Set<string>();

  /**
   * Records tool outputs the server holds, so the eager flush never re-posts
   * them.
   *
   * Takes IDs, not a message: the only sound sources are the transcript the
   * server sent and the acknowledgement's own list of what it wrote. Reading
   * them off the client's live copy of a message instead marks outputs the
   * server never received, because that copy can have moved past the snapshot
   * the server persisted — and a wrongly marked output is never flushed again.
   */
  const markToolOutputsPersisted = (
    toolCallIds: readonly string[] | undefined
  ): void => {
    for (const toolCallId of toolCallIds ?? []) {
      syncedToolOutputIds.add(toolCallId);
    }
  };

  const acknowledge = ({
    messageId,
  }: TranscriptPersistenceAcknowledgement): void => {
    const persistence = persistenceByMessageId.get(messageId);
    if (persistence?.status === "waiting") {
      persistenceByMessageId.set(messageId, { status: "consumed" });
      persistence.resolve(true);
      return;
    }
    persistenceByMessageId.set(messageId, { status: "acknowledged" });
  };

  const waitForMessage = ({
    messageId,
  }: {
    messageId: string;
  }): Promise<boolean> => {
    const persistence = persistenceByMessageId.get(messageId);
    if (persistence?.status === "acknowledged") {
      persistenceByMessageId.set(messageId, { status: "consumed" });
      return Promise.resolve(true);
    }
    if (persistence) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      persistenceByMessageId.set(messageId, { status: "waiting", resolve });
    });
  };

  const cancelPendingWaiters = (): void => {
    for (const persistence of persistenceByMessageId.values()) {
      if (persistence.status === "waiting") {
        persistence.resolve(false);
      }
    }
    persistenceByMessageId.clear();
  };

  return {
    acknowledge,
    cancelPendingWaiters,
    waitForMessage,
    markToolOutputsPersisted,
    /** Owned here; the flush marks entries in-flight and unmarks on failure. */
    syncedToolOutputIds,
  };
}
