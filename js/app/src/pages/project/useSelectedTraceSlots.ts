import { useParams, useSearchParams } from "react-router";

import type { TraceSelectionSlot } from "@phoenix/utils/traceSelectionUtils";
import { getTraceSelectionSlots } from "@phoenix/utils/traceSelectionUtils";

/**
 * The traces (and the span selected within each) that the current URL shows
 * details for, so tables can highlight the rows being viewed.
 */
export function useSelectedTraceSlots(): TraceSelectionSlot[] {
  const { traceId } = useParams();
  const [searchParams] = useSearchParams();
  return getTraceSelectionSlots({ routeTraceId: traceId, searchParams });
}
