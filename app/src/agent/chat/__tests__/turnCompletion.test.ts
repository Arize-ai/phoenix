import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTurnCompletionGate,
  DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS,
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finalizes once finish, backend complete, and terminal decision all hold", async () => {
    const { gate, endTurn, finalize } = createGate();

    gate.beginTurn();
    gate.handleBackendTurnComplete();
    gate.handleFinish(finish);
    await flushMicrotasks();

    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(finish);
  });

  it("finalizes when the backend turn-complete part arrives after finish", async () => {
    const { gate, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();
    expect(finalize).not.toHaveBeenCalled();

    gate.handleBackendTurnComplete();
    await flushMicrotasks();
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("finalizes exactly once when finish and backend complete race", async () => {
    const { gate, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    gate.handleBackendTurnComplete();
    gate.handleBackendTurnComplete();
    await flushMicrotasks();

    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("does not finalize while an automatic send will extend the turn", async () => {
    const { gate, finalize } = createGate({ shouldSendAutomatically: true });

    gate.beginTurn();
    gate.handleBackendTurnComplete();
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
    gate.handleBackendTurnComplete();
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
    gate.handleBackendTurnComplete();
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

  it("falls back to finalizing when the backend turn-complete part never arrives", async () => {
    const { gate, endTurn, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();
    expect(finalize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(
      DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS
    );

    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(finish);
  });

  it("does not double-finalize when the backend part arrives before the fallback fires", async () => {
    const { gate, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();
    gate.handleBackendTurnComplete();
    await flushMicrotasks();
    expect(finalize).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(
      DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS * 2
    );
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("abandons the pending finish on error and ends the turn with it", async () => {
    const { gate, endTurn, finalize } = createGate();
    const error = new Error("stream failed");

    gate.beginTurn();
    gate.handleFinish(finish);
    gate.fail(error);
    await vi.advanceTimersByTimeAsync(
      DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS * 2
    );

    expect(endTurn).toHaveBeenCalledWith(error);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("flushes a stale terminal finish when a new turn begins", async () => {
    const { gate, finalize } = createGate();

    gate.beginTurn();
    gate.handleFinish(finish);
    await flushMicrotasks();
    expect(finalize).not.toHaveBeenCalled();

    // User sends the next message before the fallback fired.
    gate.beginTurn();
    await flushMicrotasks();

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(finish);
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
    gate.handleBackendTurnComplete();
    gate.handleFinish(finish);
    await flushMicrotasks();

    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
