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
   * Records every resolved client tool output on a persisted message as held
   * by the server. Called for seed messages and on each transcript-persisted
   * acknowledgement; outputs resolved after an acknowledgement still flush.
   */
  const markToolOutputsPersisted = (
    message: AgentUIMessage | undefined
  ): void => {
    if (message?.role !== "assistant") {
      return;
    }
    for (const part of message.parts) {
      if (isResolvedClientToolOutputPart(part)) {
        syncedToolOutputIds.add(part.toolCallId);
      }
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
