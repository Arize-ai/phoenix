import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";

import { SpanErrorsTimeSeries } from "./SpanErrorsTimeSeries";

/**
 * A time series of LLM span error counts in the project.
 */
export function LLMSpanErrorsTimeSeries(props: ProjectMetricViewProps) {
  return (
    <SpanErrorsTimeSeries
      {...props}
      filterCondition='span_kind == "LLM"'
      emptyMessage="No LLM span errors in this time range"
    />
  );
}
