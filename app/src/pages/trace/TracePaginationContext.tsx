import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";

import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

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
    // we always navigate directly to a traceId
    let path = `/${projects}/${projectId}/${resource}/${traceId}`;
    // we add a selected span node id if provided to makeUrl
    if (currentSpanId) {
      path += `?${SELECTED_SPAN_NODE_ID_PARAM}=${currentSpanId}`;
    }
    return path;
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
