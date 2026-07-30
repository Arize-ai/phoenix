import { Loading, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/**
 * The filter field, standing in for a spans table while its condition is
 * validated.
 *
 * A view that loads only settled conditions cannot mount its table yet -- and
 * the table is where the field that validates normally lives. Rendering the
 * field here breaks that circle, and keeps the filter on screen while the user
 * waits.
 */
export function PendingSpanFilter({
  onResolved,
}: {
  /**
   * Receives the settled seed. `persistToUrl` is false for a fallback, so the
   * URL keeps the text that was rejected rather than the one being loaded.
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
          onValidCondition={({ condition, selectsRootSpansOnly }) =>
            onResolved({
              condition,
              requiresServerValidation: false,
              rootSpansOnly: selectsRootSpansOnly ?? false,
            })
          }
          // A rejected or unanswerable condition still has to resolve to
          // something loadable. The default shows root spans, as a link with no
          // filter does, rather than every span -- wider than was asked for.
          // The field keeps showing the text and its own error.
          onValidationFailed={() =>
            onResolved(
              {
                condition: DEFAULT_SPAN_FILTER_CONDITION,
                requiresServerValidation: false,
                rootSpansOnly: true,
              },
              false
            )
          }
        />
      </View>
      <Loading />
    </>
  );
}
