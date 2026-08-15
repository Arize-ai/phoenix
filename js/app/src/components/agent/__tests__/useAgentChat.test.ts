import { describe, expect, it } from "vitest";

import { getRemovedUserMessageText } from "@phoenix/agent/chat/removedUserMessageText";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import { getCompactionBlockedReason } from "../useAgentChat";

describe("getRemovedUserMessageText", () => {
  it("does not restore a compaction checkpoint into the composer", () => {
    const compactionMessage = {
      id: "compaction-message",
      role: "user",
      metadata: {
        phoenix: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
      },
      parts: [{ type: "text", text: '{"objectives":["Understand traces"]}' }],
    } as AgentUIMessage;

    expect(
      getRemovedUserMessageText([compactionMessage], compactionMessage.id)
    ).toBeNull();
  });

  it("continues to restore ordinary user messages", () => {
    const userMessage = {
      id: "user-message",
      role: "user",
      parts: [{ type: "text", text: "What is a trace?" }],
    } as AgentUIMessage;

    expect(getRemovedUserMessageText([userMessage], userMessage.id)).toBe(
      "What is a trace?"
    );
  });
});

describe("getCompactionBlockedReason", () => {
  const unblocked = {
    isResponseInProgress: false,
    isCompactionPending: false,
    isBusyElsewhere: false,
  };

  it("allows compaction when no precondition blocks it", () => {
    expect(getCompactionBlockedReason(unblocked)).toBeNull();
  });

  it("blocks while this client's response is in flight", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isResponseInProgress: true })
    ).toBe("Wait for the current response to finish and try again.");
  });

  it("blocks while a compaction is already pending", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isCompactionPending: true })
    ).toBe("Conversation compaction is already in progress.");
  });

  it("blocks while another client holds the session lock", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isBusyElsewhere: true })
    ).toBe(
      "Session is being used elsewhere. Try again when the other turn completes."
    );
  });

  it("reports the in-flight response before other blockers", () => {
    expect(
      getCompactionBlockedReason({
        isResponseInProgress: true,
        isCompactionPending: true,
        isBusyElsewhere: true,
      })
    ).toBe("Wait for the current response to finish and try again.");
  });
});
