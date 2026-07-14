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
 * Coordinates when one PXI logical turn is complete.
 *
 * A turn is finalized (messages mirrored to the durable store and the active
 * server turn trace context cleared) only when all of the following hold:
 * 1. the AI SDK reported `onFinish` for the last HTTP response,
 * 2. no further automatic sends or pending client tool outputs will extend
 *    the turn (the "terminal send decision").
 *
 * The AI SDK invokes `onFinish` and `sendAutomaticallyWhen` in orderings that
 * vary by stream shape, so each handler records its fact and completion is
 * attempted after both.
 */
export function createTurnCompletionGate({
  endTurn,
  finalize,
  getShouldSendAutomatically = (messages) =>
    shouldSendAutomaticallyAfterToolOutput({ messages }),
  getShouldKeepTurnOpen = shouldKeepTurnOpenForPendingToolOutput,
}: {
  /** Clears client state for the completed logical turn. Must not reject. */
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
}) {
  let pendingFinish: TurnFinish | null = null;
  let hasReachedTerminalSendDecision = false;

  const completeIfReady = async () => {
    if (pendingFinish == null || !hasReachedTerminalSendDecision) {
      return;
    }
    // Take the finish before awaiting so concurrent invocations finalize
    // exactly once.
    const finish = pendingFinish;
    pendingFinish = null;
    try {
      await endTurn();
    } catch {
      // Cleanup is best-effort and `endTurn` is contractually non-throwing;
      // never let a cleanup failure block persistence.
    }
    finalize(finish);
  };

  /**
   * Called before each outgoing HTTP request of a turn. Resets per-request facts.
   */
  const beginTurn = () => {
    if (pendingFinish != null && hasReachedTerminalSendDecision) {
      void completeIfReady();
    }
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
    pendingFinish = null;
    endTurn(error).catch(() => undefined);
  };

  return {
    beginTurn,
    handleSendAutomaticallyWhen,
    handleFinish,
    fail,
  };
}
