import { usePreferencesContext } from "@phoenix/contexts";

/**
 * The row-height preference the tracing tables share, together with the
 * attribute that drives {@link expandableRowsTableCSS}. Reading it through one
 * hook keeps the three tables from answering the same question differently.
 */
export function useTableRowsExpanded() {
  const isExpanded = usePreferencesContext(
    (state) => state.areTableRowsExpanded
  );
  const setIsExpanded = usePreferencesContext(
    (state) => state.setAreTableRowsExpanded
  );
  return {
    isExpanded,
    setIsExpanded,
    /** Spread onto the `<table>` that wears `expandableRowsTableCSS` */
    tableProps: { "data-rows": isExpanded ? "expanded" : "collapsed" },
  } as const;
}
