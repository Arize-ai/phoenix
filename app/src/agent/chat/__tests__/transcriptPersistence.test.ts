import { describe, expect, it } from "vitest";

import { createTranscriptPersistenceCoordinator } from "../transcriptPersistence";

describe("createTranscriptPersistenceCoordinator", () => {
  it("waits for the matching assistant message to be persisted", async () => {
    const coordinator = createTranscriptPersistenceCoordinator();
    let hasContinued = false;
    const continuation = coordinator
      .waitForMessage({ messageId: "assistant-1" })
      .then((hasPersistedMessage) => {
        hasContinued = hasPersistedMessage;
      });

    coordinator.acknowledge({ messageId: "assistant-2" });
    await Promise.resolve();
    expect(hasContinued).toBe(false);

    coordinator.acknowledge({ messageId: "assistant-1" });
    await continuation;
    expect(hasContinued).toBe(true);
  });

  it("remembers an acknowledgement that arrives before the waiter", async () => {
    const coordinator = createTranscriptPersistenceCoordinator();
    coordinator.acknowledge({ messageId: "assistant-1" });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
  });

  it("cancels a waiter when the request fails", async () => {
    const coordinator = createTranscriptPersistenceCoordinator();
    const persistence = coordinator.waitForMessage({
      messageId: "assistant-1",
    });

    coordinator.cancelPendingWaiters();

    await expect(persistence).resolves.toBe(false);
  });

  it("allows only one continuation for an assistant message", async () => {
    const coordinator = createTranscriptPersistenceCoordinator();
    coordinator.acknowledge({ messageId: "assistant-1" });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(false);
  });

  it("allows the same assistant message to continue after another persistence", async () => {
    const coordinator = createTranscriptPersistenceCoordinator();
    coordinator.acknowledge({ messageId: "assistant-1" });
    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);

    coordinator.acknowledge({ messageId: "assistant-1" });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
  });
});
