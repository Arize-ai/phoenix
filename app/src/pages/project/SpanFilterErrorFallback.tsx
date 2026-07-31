import { Alert, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { isKnownRootSpanCondition } from "./spanFilterRootScopeConstants";
import { useSpanFilters } from "./SpanFiltersContext";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/**
 * Stands in for a table whose query failed — a condition can pass validation and
 * still be rejected by the database. Re-renders the filter field, which normally
 * lives inside that table, so the condition that caused the failure stays
 * editable.
 */
export function SpanFilterErrorFallback({
  error,
  onResolved,
}: {
  /**
   * The caught error. The boundary also covers the table itself, so a failure
   * here is not necessarily the filter's fault and must not be reported as
   * though it were.
   */
  error?: string | null;
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
}) {
  const { filterCondition } = useSpanFilters();
  // The root-span predicates are written by this app, not by the user, and a
  // tab defaults to one -- so a non-empty condition is not by itself evidence
  // that anyone filtered. Naming the filter as the likely cause is only honest
  // when someone actually wrote one.
  const hasUserFilter =
    filterCondition.trim() !== "" && !isKnownRootSpanCondition(filterCondition);
  return (
    <>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="default"
        borderBottomWidth="thin"
        flex="none"
      >
        <SpanFilterConditionField
          onValidCondition={({
            condition,
            selectsRootSpansOnly,
            isInitialSettlement,
          }) => {
            // The mounted condition is the one that just failed, and it
            // revalidates just as cleanly, so only an edit should reload.
            if (isInitialSettlement) {
              return;
            }
            onResolved({
              condition,
              requiresServerValidation: false,
              rootSpansOnly: selectsRootSpansOnly ?? false,
            });
          }}
        />
      </View>
      <Alert variant="danger" banner>
        This view could not be loaded.
        {hasUserFilter
          ? " The filter above is a likely cause — comparing values of different types is the most common. Editing it reloads the view."
          : " Editing the filter above reloads the view."}
        {error ? ` (${error})` : null}
      </Alert>
    </>
  );
}
