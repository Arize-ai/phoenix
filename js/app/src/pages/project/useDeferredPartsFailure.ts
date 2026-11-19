import { useCallback, useEffect, useState } from "react";
import type { GraphQLResponse, Observable } from "relay-runtime";

type Request = Observable<GraphQLResponse> | null | undefined;

type Failure = {
  request: Request;
  hasFailed: boolean;
  /** A refetch has started, so the owner query's rows are no longer shown. */
  isSuperseded: boolean;
  /** The owner query's request or the latest refetch has not ended. */
  isPending: boolean;
};

function getInitialFailure(request: Request): Failure {
  return {
    request,
    hasFailed: false,
    isSuperseded: false,
    isPending: request != null,
  };
}

/**
 * Whether a request that was to deliver a component's deferred parts failed.
 *
 * Relay does not report a failure that arrives after a response's first part,
 * so the failure is read from the requests themselves: the owner query's,
 * each refetch, which replaces what an earlier request delivered, and each
 * next page through `onLoadMoreComplete`, which adds to it. A refetch starts
 * over when it starts (`onRefetchStart`): the rows it brings have not failed,
 * and a late failure of the owner query's request no longer counts. A new
 * owner request starts over.
 *
 * A deferred part reads as undefined while it is pending and after it fails;
 * the part has failed when it is undefined and this returns true.
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
  const onLoadMoreComplete = useCallback((error: Error | null) => {
    if (error != null) {
      setFailure((current) => ({ ...current, hasFailed: true }));
    }
  }, []);
  return {
    hasRequestFailed: failure.request === initialRequest && failure.hasFailed,
    /**
     * The owner query's request or the latest refetch is still delivering
     * parts. Relay ignores a next page until it ends, so a load waits for it.
     */
    isRequestPending: failure.request === initialRequest && failure.isPending,
    onRefetchStart,
    onRefetchComplete,
    onLoadMoreComplete,
  };
}
