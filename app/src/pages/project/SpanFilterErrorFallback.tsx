import { Alert, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
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
        This view could not be loaded. If the filter above is at fault, editing
        it will reload — comparing values of different types is the usual cause.
        {error ? ` (${error})` : null}
      </Alert>
    </>
  );
}
