import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";

import { SpanErrorsTimeSeries } from "./SpanErrorsTimeSeries";

/**
 * A time series of tool span error counts in the project.
 */
export function ToolSpanErrorsTimeSeries(props: ProjectMetricViewProps) {
  return (
    <SpanErrorsTimeSeries
      {...props}
      filterCondition='span_kind == "TOOL"'
      emptyMessage="No tool span errors in this time range"
    />
  );
}
