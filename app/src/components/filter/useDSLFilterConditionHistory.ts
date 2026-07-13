import type {
  CompletionSection,
  CompletionSource,
} from "@codemirror/autocomplete";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useMemo } from "react";

import { createDSLFilterCompletionSource } from "./dslFilterConditionFieldUtils";

/**
 * The typeahead section recent searches appear under. Rank 0 places it above
 * the built-in Suggestions (1), loaded (2), and Fields (3) groups — a
 * condition the user already ran is the most likely thing they want again.
 */
const recentSearchesSection: CompletionSection = {
  name: "Recent searches",
  rank: 0,
};

const LOCAL_STORAGE_KEY_PREFIX = "arize-phoenix-filter-history";

const DEFAULT_CAPACITY = 5;

/**
 * How long a valid condition must stay applied before it is committed to
 * history. The filter applies live as the user types, so every pause long
 * enough to validate yields an applied condition; the dwell separates
 * searches the user actually sat with from stepping stones on the way to
 * them (`latency_ms > 1` while typing `latency_ms > 1000`).
 */
export const DSL_FILTER_HISTORY_DWELL_MS = 3_000;

/**
 * The localStorage key a mount point's filter history is persisted under
 */
export function getDSLFilterConditionHistoryStorageKey(
  historyKey: string
): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}-${historyKey}`;
}

/**
 * Reads a persisted history list, tolerating missing, malformed, or foreign
 * values — history is a progressive enhancement, never an error
 */
export function readDSLFilterConditionHistory(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

/**
 * Returns the history with `condition` as its most recent entry — deduped
 * against earlier runs of the same expression and capped at `capacity`
 */
export function pushDSLFilterConditionHistory(
  history: string[],
  condition: string,
  capacity: number
): string[] {
  return [condition, ...history.filter((entry) => entry !== condition)].slice(
    0,
    capacity
  );
}

function commitConditionToHistory(
  storageKey: string,
  condition: string,
  capacity: number
) {
  const history = pushDSLFilterConditionHistory(
    readDSLFilterConditionHistory(storageKey),
    condition,
    capacity
  );
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // localStorage full or unavailable — degrade silently
  }
}

export type UseDSLFilterConditionHistoryProps = {
  /**
   * Scopes the history to its mount point — histories are deliberately not
   * global. Include the data scope in the key (e.g.
   * `span-filter-${projectId}`): an expression referencing another project's
   * annotation names is noise, not a suggestion.
   */
  historyKey: string;
  /**
   * How many recent searches to keep
   */
  capacity?: number;
};

export type DSLFilterConditionHistory = {
  /**
   * Surfaces the recent searches as a "Recent searches" typeahead group at
   * the top of the dropdown — pass via the field's `completionSources`
   */
  completionSource: CompletionSource;
  /**
   * Report every applied condition — call from `onValidCondition`. A
   * condition is committed to history only after it stays applied for a
   * short dwell (or the hook unmounts with it applied), so the intermediate
   * expressions hit while typing don't pollute the list. An empty condition
   * discards whatever is pending.
   */
  recordValidCondition: (condition: string) => void;
};

/**
 * Remembers the last few filter conditions the user actually ran and serves
 * them back through the field's own typeahead — recents appear when the
 * empty field is focused and fuzzy-match as the user types, with no extra UI
 * surface. Plugs into `DSLFilterConditionField` through its existing
 * composition seams: `completionSources` to display and `onValidCondition`
 * to capture. History persists to localStorage per `historyKey`.
 */
export function useDSLFilterConditionHistory({
  historyKey,
  capacity = DEFAULT_CAPACITY,
}: UseDSLFilterConditionHistoryProps): DSLFilterConditionHistory {
  const storageKey = getDSLFilterConditionHistoryStorageKey(historyKey);

  // The dwell is a trailing debounce: each applied condition replaces the
  // pending one and restarts the clock, so a stepping stone hit while typing
  // (`latency_ms > 1` on the way to `latency_ms > 1000`) is never committed
  const commitAfterDwell = useMemo(
    () =>
      debounce((condition: string) => {
        commitConditionToHistory(storageKey, condition, capacity);
      }, DSL_FILTER_HISTORY_DWELL_MS),
    [storageKey, capacity]
  );

  // Navigating away (or the history scope changing) while a condition is
  // applied is the strongest signal it was a real search — flush the pending
  // condition instead of losing it
  useEffect(() => () => commitAfterDwell.flush(), [commitAfterDwell]);

  const recordValidCondition = useCallback(
    (condition: string) => {
      const trimmed = condition.trim();
      if (trimmed === "") {
        // The field was cleared — whatever was pending was a stepping
        // stone, not a search
        commitAfterDwell.cancel();
        return;
      }
      commitAfterDwell(trimmed);
    },
    [commitAfterDwell]
  );

  const completionSource = useMemo(
    () =>
      // Storage is read on each invocation so the dropdown always reflects
      // the latest history, including entries committed by a sibling field
      // sharing the same key (e.g. the spans and traces tabs)
      createDSLFilterCompletionSource(() =>
        readDSLFilterConditionHistory(storageKey).map((condition, index) => ({
          label: condition,
          type: "recent-search",
          section: recentSearchesSection,
          // Recency order — without a boost CodeMirror sorts a section's
          // equally-scored options alphabetically
          boost: -index,
          // The label is a full expression, not a token — the default apply
          // would splice it in at the token before the cursor, corrupting
          // whatever is already typed. Replace the whole document instead.
          apply: (view) => {
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: condition,
              },
              selection: { anchor: condition.length },
              userEvent: "input.complete",
            });
          },
        }))
      ),
    [storageKey]
  );

  return { completionSource, recordValidCondition };
}
