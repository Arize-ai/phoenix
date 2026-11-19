import { useCallback, useEffect, useState } from "react";
import type { GraphQLResponse, Observable } from "relay-runtime";

type Request = Observable<GraphQLResponse> | null | undefined;

/** A next page of rows, by the index of the first row it added. */
type NextPage = { firstRow: number; hasFailed: boolean };

type Failure = {
  request: Request;
  /** The owner query's request or, once one has started, the latest refetch failed. */
  hasFailed: boolean;
  /** A refetch has started, so the owner query's rows are no longer shown. */
  isSuperseded: boolean;
  /** The owner query's request or the latest refetch has not ended. */
  isPending: boolean;
  nextPages: ReadonlyArray<NextPage>;
};

function getInitialFailure(request: Request): Failure {
  return {
    request,
    hasFailed: false,
    isSuperseded: false,
    isPending: request != null,
    nextPages: [],
  };
}

/**
 * Whether a request that was to deliver a component's deferred parts failed.
 *
 * Relay does not report a failure that arrives after a response's first part,
 * so the failure is read from the requests themselves: the owner query's,
 * each refetch, which replaces what an earlier request delivered, and each
 * next page, which adds rows. A failure counts only for the rows its request
 * delivered: a refetch starts over, and a next page's failure is its own rows'.
 * A new owner request starts over.
 *
 * A deferred part reads as undefined while it is pending and after it fails;
 * the part has failed when it is undefined and this reports its request
 * failed.
 *
 * @param params - the owner query's request
 * @param params.initialRequest - the request that delivered the first parts,
 * or null when the owner does not have it
 */
export function useDeferredPartsFailure({
  initialRequest,
}: {
  initialRequest: Request;
}) {
  const [failure, setFailure] = useState<Failure>(() =>
    getInitialFailure(initialRequest)
  );
  if (failure.request !== initialRequest) {
    setFailure(getInitialFailure(initialRequest));
  }
  useEffect(() => {
    const end = (hasFailed: boolean) =>
      setFailure((current) =>
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
      setFailure((current) => ({
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
      setFailure((current) => ({
        ...current,
        hasFailed: error != null,
        isSuperseded: true,
        isPending: false,
      })),
    []
  );
  const startNextPage = useCallback((firstRow: number) => {
    const setPage = (hasFailed: boolean) =>
      setFailure((current) => ({
        ...current,
        nextPages: [
          ...current.nextPages.filter((page) => page.firstRow !== firstRow),
          { firstRow, hasFailed },
        ].sort((a, b) => a.firstRow - b.firstRow),
      }));
    setPage(false);
    return (error: Error | null) => setPage(error != null);
  }, []);
  const hasRequestFailed =
    failure.request === initialRequest && failure.hasFailed;
  const { nextPages } = failure;
  const isRowFailed = useCallback(
    (rowIndex: number) => {
      const page = nextPages.findLast(({ firstRow }) => firstRow <= rowIndex);
      return page == null ? hasRequestFailed : page.hasFailed;
    },
    [hasRequestFailed, nextPages]
  );
  return {
    hasRequestFailed,
    /**
     * The owner query's request or the latest refetch is still delivering
     * parts. Relay ignores a next page until it ends, so a load waits for it.
     */
    isRequestPending: failure.request === initialRequest && failure.isPending,
    isRowFailed,
    onRefetchStart,
    onRefetchComplete,
    startNextPage,
  };
}
