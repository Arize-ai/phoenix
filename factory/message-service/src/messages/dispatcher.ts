const MESSAGE_DEDUPLICATION_WINDOW_MS = 60 * 60 * 1_000;

export class MessageDispatcher {
  private readonly pendingThreads = new Map<string, Promise<void>>();
  private readonly completedMessages = new Map<string, number>();

  /** Serialize deliveries per thread and deduplicate messages in this process for one hour. */
  dispatch({
    threadKey,
    messageKey,
    deliver,
    now = Date.now(),
  }: {
    threadKey: string;
    messageKey: string;
    deliver: () => Promise<void>;
    now?: number;
  }): Promise<void> {
    for (const [key, expiresAt] of this.completedMessages) {
      if (expiresAt < now) this.completedMessages.delete(key);
    }
    if (this.completedMessages.has(messageKey)) return Promise.resolve();
    this.completedMessages.set(
      messageKey,
      now + MESSAGE_DEDUPLICATION_WINDOW_MS
    );
    const previous = this.pendingThreads.get(threadKey) ?? Promise.resolve();
    const next = previous.then(deliver).catch((error: unknown) => {
      this.completedMessages.delete(messageKey);
      throw error;
    });
    const settled = next.then(
      () => undefined,
      () => undefined
    );
    this.pendingThreads.set(threadKey, settled);
    void settled.then(() => {
      if (this.pendingThreads.get(threadKey) === settled)
        this.pendingThreads.delete(threadKey);
    });
    return next;
  }
}
