export type TranscriptPersistenceAcknowledgement = {
  messageId: string;
  revision: number;
};

type PersistenceState =
  | { status: "acknowledged" }
  | { status: "consumed" }
  | {
      status: "waiting";
      resolve: (hasPersistedMessage: boolean) => void;
    };
/** Coordinates automatic continuations with durable transcript revisions. */
export function createTranscriptPersistenceCoordinator({
  initialRevision,
}: {
  initialRevision: number;
}) {
  let currentRevision = initialRevision;
  let resolvePendingAcknowledgement: (() => void) | null = null;
  let pendingAcknowledgement = Promise.resolve();
  const persistenceByMessageId = new Map<string, PersistenceState>();

  const beginRequest = () => {
    pendingAcknowledgement = new Promise<void>((resolve) => {
      resolvePendingAcknowledgement = resolve;
    });
    return currentRevision;
  };

  const acknowledge = ({
    messageId,
    revision,
  }: TranscriptPersistenceAcknowledgement): void => {
    currentRevision = revision;
    resolvePendingAcknowledgement?.();
    resolvePendingAcknowledgement = null;
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
    resolvePendingAcknowledgement?.();
    resolvePendingAcknowledgement = null;
    for (const persistence of persistenceByMessageId.values()) {
      if (persistence.status === "waiting") {
        persistence.resolve(false);
      }
    }
    persistenceByMessageId.clear();
  };

  const reset = (revision: number) => {
    currentRevision = revision;
    cancelPendingWaiters();
  };

  return {
    acknowledge,
    beginRequest,
    cancelPendingWaiters,
    getRevision: () => currentRevision,
    reset,
    waitForAcknowledgement: () => pendingAcknowledgement,
    waitForMessage,
  };
}
