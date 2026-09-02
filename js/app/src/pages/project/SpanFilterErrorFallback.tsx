import { DSLFilterErrorFallback } from "./DSLFilterErrorFallback";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { isKnownRootSpanCondition } from "./spanFilterRootScopeConstants";
import { useSpanFilterCondition } from "./SpanFiltersContext";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/** The span filter field over a failed spans table -- see `DSLFilterErrorFallback`. */
export function SpanFilterErrorFallback({
  error,
  onResolved,
}: {
  error?: string | null;
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
}) {
  const filterCondition = useSpanFilterCondition();
  // Root-span predicates are written by this app and a tab defaults to one, so
  // a non-empty condition is not evidence that anyone filtered.
  const hasUserFilter =
    filterCondition.trim() !== "" && !isKnownRootSpanCondition(filterCondition);
  return (
    <DSLFilterErrorFallback error={error} hasUserFilter={hasUserFilter}>
      <SpanFilterConditionField
        onValidCondition={({
          condition,
          selectsRootSpansOnly,
          isInitialSettlement,
        }) => {
          // The mounted condition just failed; only an edit should reload.
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
    </DSLFilterErrorFallback>
  );
}
