import { useCallback, useEffect, useState } from "react";
import type { GraphQLResponse, Observable } from "relay-runtime";

type Request = Observable<GraphQLResponse> | null | undefined;

/** A next page of rows, by the index of the first row it added. */
type NextPage = { firstRow: number; hasFailed: boolean };

type PayloadStatus = {
  request: Request;
  /** The owner query's request or, once one has started, the latest refetch failed. */
  hasFailed: boolean;
  /** A refetch has started, so the owner query's rows are no longer shown. */
  isSuperseded: boolean;
  /** The owner query's request or the latest refetch has not ended. */
  isPending: boolean;
  nextPages: ReadonlyArray<NextPage>;
};

function getInitialStatus(request: Request): PayloadStatus {
  return {
    request,
    hasFailed: false,
    isSuperseded: false,
    isPending: request != null,
    nextPages: [],
  };
}

/**
 * Whether a `@defer` payload failed. Relay does not report errors after the
 * first payload, so this watches the requests: the owner query, each refetch
 * (which starts over), and each next page (whose failure marks only its own
 * rows). A deferred fragment reads as undefined while its payload is pending
 * and after it fails, so it has failed when it is undefined and `hasFailed`.
 *
 * @example
 * const { hasFailed } = useDeferredPayloadStatus({ initialRequest: queryRef.source });
 * const hasNamesError = names === undefined && hasFailed;
 *
 * @param params - the owner query's request
 * @param params.initialRequest - the request that delivered the first
 * payload, or null when the owner does not have it
 */
export function useDeferredPayloadStatus({
  initialRequest,
}: {
  initialRequest: Request;
}) {
  const [status, setStatus] = useState<PayloadStatus>(() =>
    getInitialStatus(initialRequest)
  );
  if (status.request !== initialRequest) {
    setStatus(getInitialStatus(initialRequest));
  }
  useEffect(() => {
    const end = (hasFailed: boolean) =>
      setStatus((current) =>
        current.request !== initialRequest || current.isSuperseded
          ? current
          : { ...current, hasFailed, isPending: false }
      );
    const subscription = initialRequest?.subscribe({
      complete: () => end(false),
      error: () => end(true),
    });
    return () => subscription?.unsubscribe();
  }, [initialRequest]);
  const onRefetchStart = useCallback(
    () =>
      setStatus((current) => ({
        ...current,
        hasFailed: false,
        isSuperseded: true,
        isPending: true,
        nextPages: [],
      })),
    []
  );
  const onRefetchComplete = useCallback(
    (error: Error | null) =>
      setStatus((current) => ({
        ...current,
        hasFailed: error != null,
        isSuperseded: true,
        isPending: false,
      })),
    []
  );
  const trackNextPage = useCallback((firstRow: number) => {
    const setPage = (hasFailed: boolean) =>
      setStatus((current) => ({
        ...current,
        nextPages: [
          ...current.nextPages.filter((page) => page.firstRow !== firstRow),
          { firstRow, hasFailed },
        ].sort((a, b) => a.firstRow - b.firstRow),
      }));
    setPage(false);
    return (error: Error | null) => setPage(error != null);
  }, []);
  const hasFailed = status.request === initialRequest && status.hasFailed;
  const { nextPages } = status;
  const isRowFailed = useCallback(
    (rowIndex: number) => {
      const page = nextPages.findLast(({ firstRow }) => firstRow <= rowIndex);
      return page == null ? hasFailed : page.hasFailed;
    },
    [hasFailed, nextPages]
  );
  return {
    hasFailed,
    /**
     * The owner query's request or the latest refetch is still delivering
     * payloads. Relay ignores a next page until it ends, so a load waits for it.
     */
    isPending: status.request === initialRequest && status.isPending,
    isRowFailed,
    onRefetchStart,
    onRefetchComplete,
    trackNextPage,
  };
}
