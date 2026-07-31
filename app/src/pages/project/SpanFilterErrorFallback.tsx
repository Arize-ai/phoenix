import { Alert, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/**
 * The filter field and an explanation, standing in for a table whose query
 * failed.
 *
 * Validation proves a condition parses and compiles to SQL, which is not the
 * same as proving the database will accept it: a comparison between
 * incompatible types compiles and is then rejected when the query runs. So a
 * condition can reach the table already blessed as valid and still fail, and
 * that failure arrives as a thrown error during render, taking the table --
 * and the field inside it -- with it.
 *
 * Rendering the field here is what makes the failure recoverable. The field
 * normally lives inside the table, so without this the user would be left
 * looking at an error with no way to edit the condition that caused it, short
 * of editing the URL.
 */
export function SpanFilterErrorFallback({
  onResolved,
}: {
  /**
   * Receives the settled seed for a condition the user has since edited,
   * which is what reloads the table.
   */
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
            // validates just as cleanly the second time -- that is why it got
            // this far. Reloading on it would ask for the same failure again,
            // so only an edit counts.
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
