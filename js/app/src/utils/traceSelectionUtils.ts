import {
  COMPARE_TRACE_ID_PARAM,
  SELECTED_SPAN_NODE_ID_PARAM,
} from "@phoenix/constants/searchParams";
import {
  clearSelectionScopedParams,
  withSearchParams,
} from "@phoenix/utils/urlUtils";

/**
 * A trace whose details are shown, along with the span selected within it.
 * A `null` span means no explicit selection, so the trace's root span is shown.
 */
export type TraceSelectionSlot = {
  /** The OpenTelemetry trace ID */
  traceId: string;
  /** The Relay node ID of the selected span, or null for the root span */
  selectedSpanNodeId: string | null;
};

/**
 * Read the compared traces from the search, in display order. The selected
 * span for each trace is the value at the same position of the repeated
 * selected span param; a missing or empty value means no selection.
 */
export function parseCompareTraceSlots(
  search: string | URLSearchParams
): TraceSelectionSlot[] {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const traceIds = params.getAll(COMPARE_TRACE_ID_PARAM);
  const spanNodeIds = params.getAll(SELECTED_SPAN_NODE_ID_PARAM);
  // pair by position before dropping blank traces so a blank does not shift
  // the later traces onto the wrong spans
  return traceIds.flatMap((traceId, index) =>
    traceId ? [{ traceId, selectedSpanNodeId: spanNodeIds[index] || null }] : []
  );
}

/**
 * The traces whose details the URL shows: the single trace of a trace details
 * route (with its selected span), or else the traces of the compare view.
 */
export function getTraceSelectionSlots({
  routeTraceId,
  searchParams,
}: {
  /** The trace ID of the current trace details route, if on one */
  routeTraceId?: string | null;
  searchParams: URLSearchParams;
}): TraceSelectionSlot[] {
  if (routeTraceId) {
    return [
      {
        traceId: routeTraceId,
        selectedSpanNodeId:
          searchParams.get(SELECTED_SPAN_NODE_ID_PARAM) || null,
      },
    ];
  }
  return parseCompareTraceSlots(searchParams);
}

/**
 * Write the compared traces and their selected spans onto the given params,
 * replacing any previous compare state. Selected spans are written positionally
 * with an empty placeholder for traces without a selection, and trailing
 * placeholders are omitted to keep the URL short.
 */
function setCompareTraceSlots(
  params: URLSearchParams,
  slots: TraceSelectionSlot[]
): URLSearchParams {
  params.delete(COMPARE_TRACE_ID_PARAM);
  params.delete(SELECTED_SPAN_NODE_ID_PARAM);
  for (const slot of slots) {
    params.append(COMPARE_TRACE_ID_PARAM, slot.traceId);
  }
  const spanNodeIds = slots.map((slot) => slot.selectedSpanNodeId ?? "");
  while (spanNodeIds.length > 0 && spanNodeIds[spanNodeIds.length - 1] === "") {
    spanNodeIds.pop();
  }
  for (const spanNodeId of spanNodeIds) {
    params.append(SELECTED_SPAN_NODE_ID_PARAM, spanNodeId);
  }
  return params;
}

/**
 * Select a span within the compared trace at `index`, keeping every other
 * compared trace as is.
 */
export function setCompareTraceSlotSelection(
  params: URLSearchParams,
  index: number,
  spanNodeId: string
): URLSearchParams {
  const slots = parseCompareTraceSlots(params).map((slot, slotIndex) =>
    slotIndex === index ? { ...slot, selectedSpanNodeId: spanNodeId } : slot
  );
  return setCompareTraceSlots(params, slots);
}

/**
 * Build a relative path to the compare traces view for the given traces,
 * preserving recreatable URL state (such as the time range) while replacing
 * any selection-scoped state. Resolve it against the project's traces or spans
 * tab route, the same way {@link getTraceDetailsPath} is resolved.
 */
export function getCompareTracesPath({
  slots,
  searchParams,
}: {
  slots: TraceSelectionSlot[];
  searchParams: URLSearchParams;
}): string {
  return `compare${withSearchParams(
    clearSelectionScopedParams(searchParams),
    (params) => {
      setCompareTraceSlots(params, slots);
    }
  )}`;
}

/**
 * Whether the given span row is part of the trace selection: either it is a
 * slot's selected span, or it belongs to a slot's trace that has no span
 * selected (in which case the trace itself is what is selected).
 */
export function isSpanRowSelected(
  slots: TraceSelectionSlot[],
  row: { id: string; trace: { traceId: string } }
): boolean {
  return slots.some((slot) =>
    slot.selectedSpanNodeId
      ? slot.selectedSpanNodeId === row.id
      : slot.traceId === row.trace.traceId
  );
}

/**
 * The traces a set of selected spans can be compared as: exactly two spans
 * from two distinct traces. Returns null when the selection cannot be
 * compared.
 */
export function getComparableTraceSlots(
  selectedSpans: { id: string; trace: { traceId: string } }[]
): TraceSelectionSlot[] | null {
  if (selectedSpans.length !== 2) {
    return null;
  }
  const [first, second] = selectedSpans;
  if (first.trace.traceId === second.trace.traceId) {
    return null;
  }
  return selectedSpans.map((span) => ({
    traceId: span.trace.traceId,
    selectedSpanNodeId: span.id,
  }));
}
