import { usePreferencesContext } from "@phoenix/contexts";

/**
 * The row-height preference the tracing and experiments tables share, with the
 * attribute that drives `expandableRowsTableCSS`.
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
    tableProps: { "data-rows": isExpanded ? "expanded" : "collapsed" },
  } as const;
}
