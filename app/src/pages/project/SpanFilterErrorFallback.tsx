import { Alert, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/**
 * Stands in for a table whose query failed. Re-renders the filter field, which
 * normally lives inside that table, so the condition that caused the failure is
 * still editable.
 */
export function SpanFilterErrorFallback({
  onResolved,
}: {
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
        This filter condition could not be applied to the data. Comparing values
        of different types is the usual cause. Edit the condition above to
        continue.
      </Alert>
    </>
  );
}
