import { describe, expect, it, vi } from "vitest";

import {
  createTurnCompletionGate,
  type TurnFinish,
} from "@phoenix/agent/chat/turnCompletion";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

const assistantMessage: AgentUIMessage = {
  id: "assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "done" }],
};

const finish: TurnFinish = {
  finalMessages: [assistantMessage],
  message: assistantMessage,
};

function createGate({
  shouldSendAutomatically = false,
  shouldKeepTurnOpen = false,
}: {
  shouldSendAutomatically?: boolean;
  shouldKeepTurnOpen?: boolean;
} = {}) {
  const endTurn = vi.fn(async (_error?: unknown) => undefined);
  const finalize = vi.fn((_finish: TurnFinish) => undefined);
  const gate = createTurnCompletionGate({
    endTurn,
    finalize,
    getShouldSendAutomatically: () => shouldSendAutomatically,
    getShouldKeepTurnOpen: () => shouldKeepTurnOpen,
  });
  return { gate, endTurn, finalize };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createTurnCompletionGate", () => {
  it("finalizes once finish and terminal decision hold", async () => {
    const { gate, endTurn, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();

    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(finish);
  });

  it("finalizes exactly once when finish and send decision both attempt completion", async () => {
    const { gate, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await expect(
      gate.handleSendAutomaticallyWhen({ messages: [assistantMessage] })
    ).resolves.toBe(false);
    await flushMicrotasks();

    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("does not finalize while an automatic send will extend the turn", async () => {
    const { gate, finalize } = createGate({ shouldSendAutomatically: true });

    gate.beginTurn();
    gate.handleFinish(finish);
    await expect(
      gate.handleSendAutomaticallyWhen({ messages: [assistantMessage] })
    ).resolves.toBe(true);
    await flushMicrotasks();

    expect(finalize).not.toHaveBeenCalled();
  });

  it("keeps the turn open (and unsent) while client tool output is pending", async () => {
    const { gate, finalize } = createGate({ shouldKeepTurnOpen: true });

    gate.beginTurn();
    gate.handleFinish(finish);
    await expect(
      gate.handleSendAutomaticallyWhen({ messages: [assistantMessage] })
    ).resolves.toBe(false);
    await flushMicrotasks();

    expect(finalize).not.toHaveBeenCalled();
  });

  it("finalizes via the terminal decision once pending tool output resolves", async () => {
    let isToolOutputPending = true;
    const endTurn = vi.fn(async (_error?: unknown) => undefined);
    const finalize = vi.fn((_finish: TurnFinish) => undefined);
    const gate = createTurnCompletionGate({
      endTurn,
      finalize,
      getShouldSendAutomatically: () => false,
      getShouldKeepTurnOpen: () => isToolOutputPending,
    });

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();
    expect(finalize).not.toHaveBeenCalled();

    // The pending tool output resolves; the send decision becomes terminal.
    isToolOutputPending = false;
    await expect(
      gate.handleSendAutomaticallyWhen({ messages: [assistantMessage] })
    ).resolves.toBe(false);
    await flushMicrotasks();
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("abandons the pending finish on error and ends the turn with it", async () => {
    const { gate, endTurn, finalize } = createGate({
      shouldKeepTurnOpen: true,
    });
    const error = new Error("stream failed");

    gate.beginTurn();
    gate.handleFinish(finish);
    gate.fail(error);
    await flushMicrotasks();

    expect(endTurn).toHaveBeenCalledWith(error);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("does not flush an intermediate finish when an automatic send extends the turn", async () => {
    const { gate, finalize } = createGate({ shouldSendAutomatically: true });

    gate.beginTurn();
    gate.handleFinish(finish);
    await expect(
      gate.handleSendAutomaticallyWhen({ messages: [assistantMessage] })
    ).resolves.toBe(true);

    // The automatic send begins the next HTTP request of the same turn.
    gate.beginTurn();
    await flushMicrotasks();

    expect(finalize).not.toHaveBeenCalled();
  });

  it("still finalizes when endTurn throws", async () => {
    const finalize = vi.fn((_finish: TurnFinish) => undefined);
    const gate = createTurnCompletionGate({
      endTurn: async () => {
        throw new Error("tracing broke");
      },
      finalize,
      getShouldSendAutomatically: () => false,
      getShouldKeepTurnOpen: () => false,
    });

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();

    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
