import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

/**
 * View state shared between the trace tree and its toolbar.
 *
 * @remarks
 * The actions intentionally hide the underlying React state setters. Filtering
 * and global expand/collapse can update a large tree, so the provider owns the
 * `startTransition` policy and consumers call these actions directly.
 */
export type TraceTreeContextType = {
  /** Authoritative count of error spans in the full trace. */
  errorCount: number;

  /** Whether the full trace contains at least one error span. */
  hasErrors: boolean;

  /** Whether nested span nodes should be collapsed across the trace tree. */
  isCollapsed: boolean;

  /**
   * Sets the global collapse state for the trace tree.
   *
   * @param isCollapsed - `true` collapses nested spans; `false` expands them.
   */
  setIsCollapsed: (isCollapsed: boolean) => void;

  /** Trimmed query used to filter visible spans in the trace tree. */
  searchQuery: string;

  /**
   * Sets the trace tree search query.
   *
   * @param searchQuery - Raw search text. The provider trims the value before
   * applying it so all consumers share the same normalized query.
   */
  setSearchQuery: (searchQuery: string) => void;
};

/**
 * Context backing trace tree view state.
 *
 * @remarks Use {@link useTraceTree} instead of reading this context directly so
 * missing-provider errors fail with an actionable message.
 */
export const TraceTreeContext = createContext<TraceTreeContextType | null>(
  null
);

/**
 * Returns trace tree view state and actions for descendants of
 * {@link TraceTreeProvider}.
 *
 * @throws Error when called outside of a `TraceTreeProvider`.
 */
export function useTraceTree() {
  const context = useContext(TraceTreeContext);
  if (context === null) {
    throw new Error("useTraceTree must be used within a TraceTreeProvider");
  }
  return context;
}

/**
 * Provides trace tree view state to the toolbar and tree body.
 *
 * @remarks
 * State updates that can cause broad tree re-rendering are wrapped in
 * `startTransition` here so callers do not need to remember which actions are
 * potentially expensive.
 *
 * @param props - Provider props.
 * @param props.children - Trace tree UI that consumes the shared view state.
 * @param props.errorCount - Authoritative count of error spans in the trace.
 */
export function TraceTreeProvider({
  children,
  errorCount = 0,
}: PropsWithChildren<{ errorCount?: number }>) {
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [searchQuery, setSearchQueryState] = useState("");
  const hasErrors = errorCount > 0;

  /**
   * Applies a global collapse/expand request as a non-urgent update because
   * every rendered tree item may react to this value.
   */
  const setIsCollapsed = (isCollapsed: boolean) => {
    startTransition(() => {
      setIsCollapsedState(isCollapsed);
    });
  };

  /**
   * Applies a normalized search query as a non-urgent update because filtering
   * can rebuild the visible trace tree for large traces.
   */
  const setSearchQuery = (searchQuery: string) => {
    startTransition(() => {
      setSearchQueryState(searchQuery.trim());
    });
  };

  return (
    <TraceTreeContext.Provider
      value={{
        errorCount,
        hasErrors,
        isCollapsed,
        searchQuery,
        setIsCollapsed,
        setSearchQuery,
      }}
    >
      {children}
    </TraceTreeContext.Provider>
  );
}
