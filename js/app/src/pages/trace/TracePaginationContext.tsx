import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { withSearchParams } from "@phoenix/utils/urlUtils";

/**
 * A sequence of traceId/spanId pairs that represent the trace sequence.
 * The sequence is used to navigate between traces, or spans within a trace.
 */
type TraceSequence = { traceId: string; spanId: string }[];

type TracePaginationContextType = {
  traceSequence: TraceSequence;
  next: (currentId?: string) => void;
  previous: (currentId?: string) => void;
  setTraceSequence: (traceSequence: TraceSequence) => void;
};

export const TracePaginationContext =
  createContext<TracePaginationContextType | null>(null);

export const useTracePagination = () => {
  const context = useContext(TracePaginationContext);

  return context;
};

/**
 * Get the next and previous traceId/spanId pairs based on the current traceId/spanId
 * @param traceSequence - The sequence of traceId/spanId pairs to paginate against, this could be from the spans table for example
 * @param currentId - The current traceId or spanId, the first sequence with a matching traceId or spanId will be matched against
 * @returns The next and previous traceId and spanId, if they exist in the sequence
 */
export const getNeighbors = (
  traceSequence: { traceId: string; spanId: string }[],
  /** May be a traceId or a spanId */
  currentId?: string
) => {
  const currentIndex = traceSequence.findIndex(
    ({ traceId, spanId }) =>
      currentId && (traceId === currentId || spanId === currentId)
  );
  const previousIndex = currentIndex - 1;
  const nextIndex = currentIndex + 1;
  const previousSequenceMember = traceSequence[previousIndex];
  const nextSequenceMember = traceSequence[nextIndex];
  return {
    nextTraceId: nextSequenceMember?.traceId,
    nextSpanId: nextSequenceMember?.spanId,
    previousTraceId: previousSequenceMember?.traceId,
    previousSpanId: previousSequenceMember?.spanId,
  };
};

/**
 * Make the next and previous trace urls based on the current traceId, spanId, and url pathname
 * @param location - The location object from useLocation
 * @param traceSequence - The sequence of traceId/spanId pairs to paginate against, this could be from the spans table for example
 * @param currentId - The current traceId or spanId, the first sequence with a matching traceId or spanId will be matched against
 * @returns The next and previous trace urls, if they exist in the sequence
 */
export const makeTraceUrls = (
  location: ReturnType<typeof useLocation>,
  traceSequence: { traceId: string; spanId: string }[],
  currentId?: string
) => {
  const { nextTraceId, previousTraceId, nextSpanId, previousSpanId } =
    getNeighbors(traceSequence, currentId);
  // split up the url pathname into its components
  // e.g. /projects/my-project/traces/123/spans/456 -> ["projects", "my-project", "traces", "123", "spans", "456"]
  // we only really care about the last two components, which are the projectId and the resource
  // resource is either "traces" or "spans", which we need to keep track of so we can build the correct url
  const [projects, projectId, resource] = location.pathname
    .split("/")
    .filter((part) => part !== "");
  const makeUrl = (traceId: string, currentSpanId?: string) => {
    // we always navigate directly to a traceId; encode it because the ingested
    // ID is not guaranteed to be path-safe and a path- or protocol-relative
    // value would otherwise escape the intended route
    const path = `/${projects}/${projectId}/${resource}/${encodeURIComponent(traceId)}`;
    const search = withSearchParams(location.search, (params) => {
      if (currentSpanId) {
        params.set(SELECTED_SPAN_NODE_ID_PARAM, currentSpanId);
      } else {
        params.delete(SELECTED_SPAN_NODE_ID_PARAM);
      }
    });
    return `${path}${search}${location.hash}`;
  };
  const hasNext = !!nextTraceId;
  const hasPrevious = !!previousTraceId;
  // we build the next and previous trace urls if the traceId is present for those directions
  return {
    nextTracePath: hasNext ? makeUrl(nextTraceId, nextSpanId) : null,
    previousTracePath: hasPrevious
      ? makeUrl(previousTraceId, previousSpanId)
      : null,
  };
};

export const TracePaginationProvider = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [traceSequence, setTraceSequence] = useState<
    { traceId: string; spanId: string }[]
  >([]);

  const next = useCallback(
    (currentId?: string) => {
      const { nextTracePath } = makeTraceUrls(
        location,
        traceSequence,
        currentId
      );
      if (nextTracePath) {
        navigate(nextTracePath);
      }
    },
    [navigate, location, traceSequence]
  );

  const previous = useCallback(
    (currentId?: string) => {
      const { previousTracePath } = makeTraceUrls(
        location,
        traceSequence,
        currentId
      );
      if (previousTracePath) {
        navigate(previousTracePath);
      }
    },
    [navigate, location, traceSequence]
  );

  return (
    <TracePaginationContext.Provider
      value={{
        traceSequence,
        next,
        previous,
        setTraceSequence,
      }}
    >
      {children}
    </TracePaginationContext.Provider>
  );
};
