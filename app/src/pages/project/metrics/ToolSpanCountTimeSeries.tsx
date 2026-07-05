import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";

import { SpanCountTimeSeries } from "./SpanCountTimeSeries";

/**
 * A time series of tool span counts in the project, broken down by status.
 */
export function ToolSpanCountTimeSeries(props: ProjectMetricViewProps) {
  return (
    <SpanCountTimeSeries {...props} filterCondition='span_kind == "TOOL"' />
  );
}
