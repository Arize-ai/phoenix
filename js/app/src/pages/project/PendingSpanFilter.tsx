import { PendingDSLFilter } from "./PendingDSLFilter";
import {
  SpanFilterConditionField,
  type SpanFilterValidConditionArgs,
} from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

export function PendingSpanFilter({
  onResolved,
}: {
  /**
   * Receives the settled seed. `persistToUrl` is false for a fallback, so the
   * URL keeps the text that was rejected rather than the one being loaded.
   */
  onResolved: (
    seed: SettledSpanFilterSeed,
    persistToUrl?: boolean,
    history?: "push" | "replace"
  ) => void;
}) {
  return (
    <PendingDSLFilter
      onValidCondition={({
        condition,
        selectsRootSpansOnly,
        isInitialSettlement,
      }: SpanFilterValidConditionArgs) =>
        onResolved(
          {
            condition,
            requiresServerValidation: false,
            rootSpansOnly: selectsRootSpansOnly ?? false,
          },
          true,
          isInitialSettlement ? "replace" : "push"
        )
      }
      // Fall back to what a link with no filter shows: root spans, not every span.
      onRejected={() =>
        onResolved(
          {
            condition: DEFAULT_SPAN_FILTER_CONDITION,
            requiresServerValidation: false,
            rootSpansOnly: true,
          },
          false
        )
      }
      renderField={(fieldProps) => <SpanFilterConditionField {...fieldProps} />}
    />
  );
}
