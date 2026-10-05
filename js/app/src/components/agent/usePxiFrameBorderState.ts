import { useEffect, useState } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";
import type { BrowserActionRun } from "@phoenix/store/agentStore";

import type { PxiFrameBorderState } from "./PxiFrameBorder";

export const DEFAULT_LONG_RUN_THRESHOLD_MS = 1000;
export const DEFAULT_MINIMUM_VISIBLE_MS = 600;
export const DEFAULT_GAP_GRACE_MS = 250;

export type UsePxiFrameBorderStateParams = {
  /** How long a sandbox run must last before the border reads as acting. */
  longRunThresholdMs?: number;
  /** The shortest time the border stays visible once a run starts. */
  minimumVisibleMs?: number;
  /** A run starting within this window after the last one ended continues the current state. */
  gapGraceMs?: number;
};

function getEarliest(values: Array<number | null>): number | null {
  let earliest: number | null = null;
  for (const value of values) {
    if (value != null && (earliest == null || value < earliest)) {
      earliest = value;
    }
  }
  return earliest;
}

/**
 * Derives the app-frame border state from the active `execute_browser_action`
 * calls across every session. A call reads as quick from the moment it is
 * planned; it turns long only once its sandbox run passes the threshold.
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

    const sync = (runsByToolCallId: Record<string, BrowserActionRun>) => {
      const runs = Object.values(runsByToolCallId);
      clearTimeout(longTimer);
      if (runs.length > 0) {
        clearTimeout(idleTimer);
        spanStartedAt ??= getEarliest(runs.map((run) => run.startedAt));
        const earliestRunStartedAt = getEarliest(
          runs.map((run) => run.runStartedAt)
        );
        if (earliestRunStartedAt == null) {
          setState((current) => (current === "long" ? "long" : "quick"));
          return;
        }
        const untilLongMs =
          earliestRunStartedAt + longRunThresholdMs - Date.now();
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
