import { useEffect, useState } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";
import type { BrowserActionRun } from "@phoenix/store/agentStore";

import type { PxiFrameBorderState } from "./PxiFrameBorder";

export const DEFAULT_LONG_RUN_THRESHOLD_MS = 1000;
export const DEFAULT_MINIMUM_VISIBLE_MS = 600;
export const DEFAULT_GAP_GRACE_MS = 250;

export type UsePxiFrameBorderStateParams = {
  /** How long runs must stay active before the border reads as acting. */
  longRunThresholdMs?: number;
  /** The shortest time the border stays visible once a run starts. */
  minimumVisibleMs?: number;
  /** A run starting within this window after the last one ended continues the current state. */
  gapGraceMs?: number;
};

function getEarliestStartedAt(
  runs: Record<string, BrowserActionRun>
): number | null {
  let earliest: number | null = null;
  for (const run of Object.values(runs)) {
    if (earliest == null || run.startedAt < earliest) {
      earliest = run.startedAt;
    }
  }
  return earliest;
}

/**
 * Derives the app-frame border state from the active `execute_browser_action`
 * sandbox runs across every session.
 */
export function usePxiFrameBorderState({
  longRunThresholdMs = DEFAULT_LONG_RUN_THRESHOLD_MS,
  minimumVisibleMs = DEFAULT_MINIMUM_VISIBLE_MS,
  gapGraceMs = DEFAULT_GAP_GRACE_MS,
}: UsePxiFrameBorderStateParams = {}): PxiFrameBorderState {
  const store = useAgentStore();
  const [state, setState] = useState<PxiFrameBorderState>("idle");

  useEffect(() => {
    // The start of the current visible span; a run that starts within the
    // gap grace extends the span instead of opening a new one.
    let spanStartedAt: number | null = null;
    let longTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const sync = (runs: Record<string, BrowserActionRun>) => {
      const earliestStartedAt = getEarliestStartedAt(runs);
      clearTimeout(longTimer);
      if (earliestStartedAt != null) {
        clearTimeout(idleTimer);
        spanStartedAt ??= earliestStartedAt;
        const untilLongMs = spanStartedAt + longRunThresholdMs - Date.now();
        if (untilLongMs <= 0) {
          setState("long");
          return;
        }
        setState((current) => (current === "long" ? "long" : "quick"));
        longTimer = setTimeout(() => setState("long"), untilLongMs);
        return;
      }
      if (spanStartedAt == null) {
        return;
      }
      clearTimeout(idleTimer);
      const untilMinimumVisibleMs =
        spanStartedAt + minimumVisibleMs - Date.now();
      idleTimer = setTimeout(
        () => {
          spanStartedAt = null;
          setState("idle");
        },
        Math.max(gapGraceMs, untilMinimumVisibleMs)
      );
    };

    sync(store.getState().browserActionRunsByToolCallId);
    const unsubscribe = store.subscribe((next, previous) => {
      if (
        next.browserActionRunsByToolCallId !==
        previous.browserActionRunsByToolCallId
      ) {
        sync(next.browserActionRunsByToolCallId);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(longTimer);
      clearTimeout(idleTimer);
    };
  }, [store, longRunThresholdMs, minimumVisibleMs, gapGraceMs]);

  return state;
}
