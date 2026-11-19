import { useCallback, useEffect, useState } from "react";
import type { GraphQLResponse, Observable } from "relay-runtime";

type Request = Observable<GraphQLResponse> | null | undefined;

type Failure = {
  request: Request;
  hasFailed: boolean;
  /** A refetch has started, so the owner query's rows are no longer shown. */
  isSuperseded: boolean;
};

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
  const [failure, setFailure] = useState<Failure>({
    request: initialRequest,
    hasFailed: false,
    isSuperseded: false,
  });
  if (failure.request !== initialRequest) {
    setFailure({
      request: initialRequest,
      hasFailed: false,
      isSuperseded: false,
    });
  }
  useEffect(() => {
    const subscription = initialRequest?.subscribe({
      error: () =>
        setFailure((current) =>
          current.request !== initialRequest || current.isSuperseded
            ? current
            : { ...current, hasFailed: true }
        ),
    });
    return () => subscription?.unsubscribe();
  }, [initialRequest]);
  const onRefetchStart = useCallback(
    () =>
      setFailure((current) => ({
        ...current,
        hasFailed: false,
        isSuperseded: true,
      })),
    []
  );
  const onRefetchComplete = useCallback(
    (error: Error | null) =>
      setFailure((current) => ({
        ...current,
        hasFailed: error != null,
        isSuperseded: true,
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
    onRefetchStart,
    onRefetchComplete,
    onLoadMoreComplete,
  };
}
