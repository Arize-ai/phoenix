import { useEffect, useState } from "react";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";

import type { ExpectedOutput } from "./calibration";

/** Annotations keyed by example id, then annotation name. `null` clears. */
export type PendingExpectedOutputs = Record<
  string,
  Record<string, ExpectedOutput | null>
>;

export type ExpectedOutputSaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

export type ExpectedOutputQueueState = {
  /** Every annotation not yet confirmed by the server, in flight or not, so the
   * table can show it as recorded the moment it is made. */
  overlay: PendingExpectedOutputs;
  pendingCount: number;
  isSaving: boolean;
  status: ExpectedOutputSaveStatus;
  error: string | null;
};

/** Wait this long after the last annotation before writing. */
export const EXPECTED_OUTPUT_IDLE_MS = 2000;
/** Never let continuous annotating postpone a write longer than this. */
export const EXPECTED_OUTPUT_MAX_WAIT_MS = 10000;
/** How long "Saved" stays up after a write lands. */
const SAVED_NOTICE_MS = 2500;

const EMPTY: PendingExpectedOutputs = {};

/** Later annotations win: `over` replaces matching entries in `under`. */
export function mergePendingExpectedOutputs(
  under: PendingExpectedOutputs,
  over: PendingExpectedOutputs
): PendingExpectedOutputs {
  const merged: PendingExpectedOutputs = { ...under };
  for (const [exampleId, byName] of Object.entries(over))
    merged[exampleId] = { ...merged[exampleId], ...byName };
  return merged;
}

function countPending(pending: PendingExpectedOutputs) {
  return Object.values(pending).reduce(
    (count, byName) => count + Object.keys(byName).length,
    0
  );
}

/**
 * Coalesces annotations into batches. Annotating is bursty — a person works down a
 * column — and each write costs a dataset version, so annotations wait for a short
 * idle gap (bounded by a maximum wait) and go out together. Annotations made while
 * a batch is in flight form the next batch; a failed batch returns to the
 * queue for retry with anything annotated since layered on top.
 *
 * Timers are injectable so the behavior can be tested without real time.
 */
export function createExpectedOutputQueue({
  flush,
  onChange,
  idleMs = EXPECTED_OUTPUT_IDLE_MS,
  maxWaitMs = EXPECTED_OUTPUT_MAX_WAIT_MS,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: {
  flush: (batch: PendingExpectedOutputs) => Promise<UIOperationResult>;
  onChange?: (state: ExpectedOutputQueueState) => void;
  idleMs?: number;
  maxWaitMs?: number;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}) {
  let flushImpl = flush;
  let pending: PendingExpectedOutputs = EMPTY;
  let inFlight: PendingExpectedOutputs | null = null;
  let current: Promise<UIOperationResult> | null = null;
  let error: string | null = null;
  let showSaved = false;
  let idleTimer: unknown = null;
  let maxTimer: unknown = null;
  let savedTimer: unknown = null;

  function clearTimers() {
    if (idleTimer != null) cancel(idleTimer);
    if (maxTimer != null) cancel(maxTimer);
    idleTimer = null;
    maxTimer = null;
  }
  function getState(): ExpectedOutputQueueState {
    const pendingCount = countPending(pending);
    const status: ExpectedOutputSaveStatus = inFlight
      ? "saving"
      : error
        ? "error"
        : pendingCount
          ? "pending"
          : showSaved
            ? "saved"
            : "idle";
    return {
      overlay: inFlight
        ? mergePendingExpectedOutputs(inFlight, pending)
        : pending,
      pendingCount,
      isSaving: inFlight != null,
      status,
      error,
    };
  }
  function emit() {
    onChange?.(getState());
  }
  function enqueue(
    exampleId: string,
    annotationName: string,
    output: ExpectedOutput | null
  ) {
    pending = {
      ...pending,
      [exampleId]: { ...pending[exampleId], [annotationName]: output },
    };
    error = null;
    showSaved = false;
    if (idleTimer != null) cancel(idleTimer);
    idleTimer = schedule(() => void flushNow(), idleMs);
    maxTimer ??= schedule(() => void flushNow(), maxWaitMs);
    emit();
  }
  async function flushNow(): Promise<UIOperationResult> {
    clearTimers();
    // One batch at a time: let the in-flight one settle, then send what has
    // accumulated since (which may be nothing).
    if (current) await current;
    if (!countPending(pending)) return { ok: true };
    const batch = pending;
    pending = EMPTY;
    inFlight = batch;
    emit();
    current = flushImpl(batch).then(
      (result) => result,
      (reason) => ({
        ok: false as const,
        error: reason instanceof Error ? reason.message : String(reason),
      })
    );
    const result = await current;
    current = null;
    inFlight = null;
    if (result.ok) {
      showSaved = true;
      if (savedTimer != null) cancel(savedTimer);
      savedTimer = schedule(() => {
        showSaved = false;
        emit();
      }, SAVED_NOTICE_MS);
    } else {
      // Back to the queue, under anything annotated meanwhile.
      pending = mergePendingExpectedOutputs(batch, pending);
      error = result.error;
    }
    emit();
    return result;
  }
  /** Swap the writer, so a React owner can keep it pointed at fresh state. */
  function setFlush(next: typeof flush) {
    flushImpl = next;
  }
  return { enqueue, flushNow, getState, setFlush };
}

export type ExpectedOutputQueue = ReturnType<typeof createExpectedOutputQueue>;

/**
 * The queue as React state. The writer is re-pointed after every render so a
 * timer firing later sees the current sample and dataset.
 */
export function useExpectedOutputQueue(
  flush: (batch: PendingExpectedOutputs) => Promise<UIOperationResult>
) {
  const [state, setState] = useState<ExpectedOutputQueueState>({
    overlay: EMPTY,
    pendingCount: 0,
    isSaving: false,
    status: "idle",
    error: null,
  });
  const [queue] = useState(() =>
    createExpectedOutputQueue({ flush, onChange: setState })
  );
  useEffect(() => {
    queue.setFlush(flush);
  });
  const hasUnsaved = state.pendingCount > 0 || state.isSaving;
  // A tab closing mid-burst would drop annotations; ask first, as the prompt
  // playground does for a running experiment.
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsaved]);
  // Leaving the page in-app still writes whatever is queued.
  useEffect(() => {
    return () => {
      void queue.flushNow();
    };
  }, [queue]);
  return { ...state, enqueue: queue.enqueue, flushNow: queue.flushNow };
}
