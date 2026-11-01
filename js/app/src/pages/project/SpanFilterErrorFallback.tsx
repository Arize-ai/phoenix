import { DSLFilterErrorFallback } from "./DSLFilterErrorFallback";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

export function SpanFilterErrorFallback({
  error,
  onResolved,
}: {
  error?: string | null;
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
}) {
  return (
    <DSLFilterErrorFallback error={error}>
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
