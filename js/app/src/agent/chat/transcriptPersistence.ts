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

/** Coordinates automatic continuations with durable assistant messages. */
export function createTranscriptPersistenceCoordinator() {
  const persistenceByMessageId = new Map<string, PersistenceState>();

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
  };
}
