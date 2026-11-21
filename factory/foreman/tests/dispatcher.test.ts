import { describe, expect, it } from "vitest";

import { MessageDispatcher } from "../src/messages/dispatcher";

describe("in-memory message dispatch", () => {
  it("serializes messages per thread and deduplicates overlapping Slack subscriptions", async () => {
    const dispatcher = new MessageDispatcher();
    const delivered: string[] = [];
    let finishFirst: (() => void) | undefined;
    const first = dispatcher.dispatch({
      threadKey: "thread",
      messageKey: "channel:1",
      deliver: async () => {
        await new Promise<void>((resolve) => {
          finishFirst = resolve;
        });
        delivered.push("first");
      },
    });
    const duplicate = dispatcher.dispatch({
      threadKey: "thread",
      messageKey: "channel:1",
      deliver: async () => {
        delivered.push("duplicate");
      },
    });
    const second = dispatcher.dispatch({
      threadKey: "thread",
      messageKey: "channel:2",
      deliver: async () => {
        delivered.push("second");
      },
    });
    await Promise.resolve();
    expect(delivered).toEqual([]);
    finishFirst?.();
    await Promise.all([first, duplicate, second]);
    expect(delivered).toEqual(["first", "second"]);
  });

  it("allows retry after failure without blocking subsequent messages", async () => {
    const dispatcher = new MessageDispatcher();
    await expect(
      dispatcher.dispatch({
        threadKey: "thread",
        messageKey: "1",
        deliver: async () => {
          throw new Error("unavailable");
        },
      })
    ).rejects.toThrow("unavailable");
    let hasDelivered = false;
    await dispatcher.dispatch({
      threadKey: "thread",
      messageKey: "1",
      deliver: async () => {
        hasDelivered = true;
      },
    });
    expect(hasDelivered).toBe(true);
  });
});
