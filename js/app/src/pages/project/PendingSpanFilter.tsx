import { PendingDSLFilter } from "./PendingDSLFilter";
import {
  SpanFilterConditionField,
  type SpanFilterValidConditionArgs,
} from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/** The span filter field, standing in for a spans table -- see `PendingDSLFilter`. */
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
    <PendingDSLFilter
      onValidCondition={({
        condition,
        selectsRootSpansOnly,
      }: SpanFilterValidConditionArgs) =>
        onResolved({
          condition,
          requiresServerValidation: false,
          rootSpansOnly: selectsRootSpansOnly ?? false,
        })
      }
      // The default shows root spans, as a link with no filter does, rather
      // than every span -- wider than was asked for.
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
