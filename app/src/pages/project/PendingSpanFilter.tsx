import { Loading, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import { spanFilterSeed, type SettledSpanFilterSeed } from "./spanFilterSeed";

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
  fallbackCondition = DEFAULT_SPAN_FILTER_CONDITION,
}: {
  /**
   * Receives the settled seed. This component passes `persistToUrl: false` for
   * a fallback, so the URL keeps the text that was rejected rather than the one
   * being loaded. Other callers pass it for their own reasons.
   */
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
  /**
   * What to load when the condition cannot be validated. Must be one this app
   * can classify, and must match what the host view shows when the URL carries
   * no condition -- the traces tab shows every span, so it passes `""` rather
   * than inheriting the spans tab's root-span default.
   */
  fallbackCondition?: string;
}) {
  const fallbackSeed = spanFilterSeed(fallbackCondition);
  if (fallbackSeed.requiresServerValidation) {
    throw new Error(
      `PendingSpanFilter fallback must not need validation: ${fallbackCondition}`
    );
  }
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
          // something loadable, so fall back to what this view shows with no
          // filter at all rather than to something wider or narrower. The field
          // keeps showing the text and its own error.
          onValidationFailed={() => onResolved(fallbackSeed, false)}
        />
      </View>
      <Loading />
    </>
  );
}
