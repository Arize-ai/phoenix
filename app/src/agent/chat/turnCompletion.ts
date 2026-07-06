import {
  shouldKeepTurnOpenForPendingToolOutput,
  shouldSendAutomaticallyAfterToolOutput,
} from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

export type TurnFinish = {
  finalMessages: AgentUIMessage[] | undefined;
  message: AgentUIMessage;
};

/**
 * How long to wait for the backend's `data-pxi-turn-complete` part after the
 * turn is otherwise finished before finalizing anyway. The fallback trades
 * degraded trace linkage for a guarantee that chat history is never lost to a
 * truncated stream or a backend that skipped its completion chunk.
 */
export const DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS = 10_000;

/**
 * Coordinates when one PXI logical turn is complete.
 *
 * A turn is finalized (messages mirrored to the durable store, browser trace
 * ended) only when all of the following hold:
 * 1. the AI SDK reported `onFinish` for the last HTTP response,
 * 2. no further automatic sends or pending client tool outputs will extend
 *    the turn (the "terminal send decision"), and
 * 3. the backend confirmed its trace flush via the turn-complete data part —
 *    or the fallback timeout elapsed waiting for it.
 *
 * The AI SDK invokes `onFinish`, `onData`, and `sendAutomaticallyWhen` in
 * orderings that vary by stream shape, so each handler records its fact and
 * completion is attempted after every one of them.
 */
export function createTurnCompletionGate({
  endTurn,
  finalize,
  getShouldSendAutomatically = (messages) =>
    shouldSendAutomaticallyAfterToolOutput({ messages }),
  getShouldKeepTurnOpen = shouldKeepTurnOpenForPendingToolOutput,
  backendTurnCompleteFallbackMs = DEFAULT_BACKEND_TURN_COMPLETE_FALLBACK_MS,
}: {
  /** Ends the browser-side turn trace. Must not reject. */
  endTurn: (error?: unknown) => Promise<void>;
  /** Persists the finished turn (store mirror, usage, summary). */
  finalize: (finish: TurnFinish) => void;
  /** Overridable for tests. Defaults to the shared send-decision helper. */
  getShouldSendAutomatically?: (messages: AgentUIMessage[]) => boolean;
  /** Overridable for tests. Defaults to the shared keep-open helper. */
  getShouldKeepTurnOpen?: (options: {
    messages: AgentUIMessage[];
    shouldSendAutomatically: boolean;
  }) => boolean;
  /** Fallback wait for the backend turn-complete part before finalizing. */
  backendTurnCompleteFallbackMs?: number;
}) {
  let pendingFinish: TurnFinish | null = null;
  let hasReceivedBackendTurnComplete = false;
  let hasReachedTerminalSendDecision = false;
  let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearBackendCompleteFallback = () => {
    if (fallbackTimeoutId != null) {
      clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = null;
    }
  };

  const armBackendCompleteFallback = () => {
    if (fallbackTimeoutId != null) {
      return;
    }
    fallbackTimeoutId = setTimeout(() => {
      fallbackTimeoutId = null;
      // Degraded path: proceed without backend confirmation so a truncated
      // stream can never strand the turn's history outside the durable store.
      hasReceivedBackendTurnComplete = true;
      void completeIfReady();
    }, backendTurnCompleteFallbackMs);
  };

  const completeIfReady = async () => {
    if (pendingFinish == null || !hasReachedTerminalSendDecision) {
      return;
    }
    if (!hasReceivedBackendTurnComplete) {
      armBackendCompleteFallback();
      return;
    }
    clearBackendCompleteFallback();
    // Take the finish before awaiting so concurrent invocations (onData and
    // onFinish both attempt completion) finalize exactly once.
    const finish = pendingFinish;
    pendingFinish = null;
    try {
      await endTurn();
    } catch {
      // Tracing is best-effort and `endTurn` is contractually non-throwing;
      // never let a tracing failure block persistence.
    }
    finalize(finish);
  };

  /**
   * Called before each outgoing HTTP request of a turn. Resets per-request
   * facts and, when a previous turn finished but its backend confirmation
   * never arrived, flushes it immediately so history is not lost.
   */
  const beginTurn = () => {
    clearBackendCompleteFallback();
    if (pendingFinish != null && hasReachedTerminalSendDecision) {
      hasReceivedBackendTurnComplete = true;
      void completeIfReady();
    }
    hasReceivedBackendTurnComplete = false;
    hasReachedTerminalSendDecision = false;
  };

  /** Wire to the AI SDK Chat's `sendAutomaticallyWhen`. */
  const handleSendAutomaticallyWhen = async ({
    messages,
  }: {
    messages: AgentUIMessage[];
  }): Promise<boolean> => {
    const shouldSendAutomatically = getShouldSendAutomatically(messages);
    if (getShouldKeepTurnOpen({ messages, shouldSendAutomatically })) {
      return false;
    }
    if (!shouldSendAutomatically) {
      hasReachedTerminalSendDecision = true;
      await completeIfReady();
    }
    return shouldSendAutomatically;
  };

  /** Wire to receipt of the backend's turn-complete data part. */
  const handleBackendTurnComplete = () => {
    hasReceivedBackendTurnComplete = true;
    void completeIfReady();
  };

  /** Wire to the AI SDK Chat's `onFinish`. */
  const handleFinish = (finish: TurnFinish) => {
    pendingFinish = finish;
    const finalMessages = finish.finalMessages;
    if (finalMessages == null) {
      // Without messages nothing can extend the turn; treat it as terminal so
      // the gate cannot strand the finish.
      hasReachedTerminalSendDecision = true;
    } else {
      const shouldSendAutomatically = getShouldSendAutomatically(finalMessages);
      if (
        !getShouldKeepTurnOpen({
          messages: finalMessages,
          shouldSendAutomatically,
        }) &&
        !shouldSendAutomatically
      ) {
        hasReachedTerminalSendDecision = true;
      }
    }
    void completeIfReady();
  };

  /** Wire to the AI SDK Chat's `onError`. Abandons the pending finish. */
  const fail = (error: unknown) => {
    clearBackendCompleteFallback();
    pendingFinish = null;
    endTurn(error).catch(() => undefined);
  };

  return {
    beginTurn,
    handleSendAutomaticallyWhen,
    handleBackendTurnComplete,
    handleFinish,
    fail,
  };
}
