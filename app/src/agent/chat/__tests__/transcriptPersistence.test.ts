import { describe, expect, it } from "vitest";

import { createTranscriptPersistenceCoordinator } from "../transcriptPersistence";

describe("createTranscriptPersistenceCoordinator", () => {
  it("blocks a follow-up until persistence is acknowledged", async () => {
    const barrier = createTranscriptPersistenceCoordinator({
      initialRevision: 3,
    });
    expect(barrier.beginRequest()).toBe(3);
    let hasContinued = false;
    const continuation = barrier.waitForAcknowledgement().then(() => {
      hasContinued = true;
    });
    await Promise.resolve();
    expect(hasContinued).toBe(false);

    barrier.acknowledge({ messageId: "assistant-1", revision: 4 });
    await continuation;
    expect(hasContinued).toBe(true);
    expect(barrier.getRevision()).toBe(4);
  });

  it("uses the acknowledged revision for the next request", () => {
    const barrier = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    expect(barrier.beginRequest()).toBe(0);
    barrier.acknowledge({ messageId: "assistant-1", revision: 1 });
    expect(barrier.beginRequest()).toBe(1);
  });

  it("waits for the matching assistant message to be persisted", async () => {
    const coordinator = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    let hasContinued = false;
    const continuation = coordinator
      .waitForMessage({ messageId: "assistant-1" })
      .then((hasPersistedMessage) => {
        hasContinued = hasPersistedMessage;
      });

    coordinator.acknowledge({ messageId: "assistant-2", revision: 1 });
    await Promise.resolve();
    expect(hasContinued).toBe(false);

    coordinator.acknowledge({ messageId: "assistant-1", revision: 2 });
    await continuation;
    expect(hasContinued).toBe(true);
  });

  it("remembers an acknowledgement that arrives before the waiter", async () => {
    const coordinator = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    coordinator.acknowledge({ messageId: "assistant-1", revision: 1 });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
  });

  it("cancels a waiter when the request fails", async () => {
    const coordinator = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    const persistence = coordinator.waitForMessage({
      messageId: "assistant-1",
    });

    coordinator.cancelPendingWaiters();

    await expect(persistence).resolves.toBe(false);
  });

  it("allows only one continuation for an assistant message", async () => {
    const coordinator = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    coordinator.acknowledge({ messageId: "assistant-1", revision: 1 });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(false);
  });

  it("allows the same assistant message to continue after another persistence", async () => {
    const coordinator = createTranscriptPersistenceCoordinator({
      initialRevision: 0,
    });
    coordinator.acknowledge({ messageId: "assistant-1", revision: 1 });
    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);

    coordinator.acknowledge({ messageId: "assistant-1", revision: 2 });

    await expect(
      coordinator.waitForMessage({ messageId: "assistant-1" })
    ).resolves.toBe(true);
  });

  it("releases a waiter when a request fails", async () => {
    const barrier = createTranscriptPersistenceCoordinator({
      initialRevision: 2,
    });
    barrier.beginRequest();
    const acknowledgement = barrier.waitForAcknowledgement();
    barrier.cancelPendingWaiters();
    await expect(acknowledgement).resolves.toBeUndefined();
    expect(barrier.getRevision()).toBe(2);
  });
});
