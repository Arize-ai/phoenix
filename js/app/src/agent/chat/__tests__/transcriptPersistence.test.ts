import { describe, expect, it } from "vitest";

import {
  createTranscriptPersistenceCoordinator,
  resolvedClientToolOutputIds,
} from "../transcriptPersistence";
import type { AgentUIMessage } from "../types";

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

  it("marks only the tool outputs it is given", () => {
    const coordinator = createTranscriptPersistenceCoordinator();

    coordinator.markToolOutputsPersisted(["tool-call-a", "tool-call-b"]);

    expect(coordinator.syncedToolOutputIds).toEqual(
      new Set(["tool-call-a", "tool-call-b"])
    );
  });

  it("marks nothing when the acknowledgement names no outputs", () => {
    const coordinator = createTranscriptPersistenceCoordinator();

    // An older server, or a turn that persisted no client outputs. Either way
    // the flush must stay free to send them.
    coordinator.markToolOutputsPersisted(undefined);
    coordinator.markToolOutputsPersisted([]);

    expect(coordinator.syncedToolOutputIds.size).toBe(0);
  });
});

describe("resolvedClientToolOutputIds", () => {
  it("picks resolved client tool outputs off a server-provided message", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-edit_prompt",
          toolCallId: "tool-call-resolved",
          state: "output-available",
          input: {},
          output: { applied: true },
          callProviderMetadata: {
            phoenix: { toolExecutionEnvironment: "client" },
          },
        },
        {
          type: "tool-edit_prompt",
          toolCallId: "tool-call-pending",
          state: "input-available",
          input: {},
          callProviderMetadata: {
            phoenix: { toolExecutionEnvironment: "client" },
          },
        },
        {
          type: "tool-bash",
          toolCallId: "tool-call-server",
          state: "output-available",
          input: {},
          output: "done",
        },
      ],
    } as AgentUIMessage;

    // Server-executed and still-pending calls are not the client's to flush.
    expect(resolvedClientToolOutputIds(message)).toEqual([
      "tool-call-resolved",
    ]);
  });

  it("ignores non-assistant and missing messages", () => {
    expect(resolvedClientToolOutputIds(undefined)).toEqual([]);
    expect(
      resolvedClientToolOutputIds({
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      } as AgentUIMessage)
    ).toEqual([]);
  });
});
