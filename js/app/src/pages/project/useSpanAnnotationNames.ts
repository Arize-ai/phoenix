import { useEffect, useRef, useState } from "react";
import {
  fetchQuery,
  graphql,
  readInlineData,
  useRelayEnvironment,
} from "react-relay";
import type { GraphQLResponse, Observable, Subscription } from "relay-runtime";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { useSpanAnnotationNames_project$key } from "./__generated__/useSpanAnnotationNames_project.graphql";
import { useDeferredPayloadStatus } from "./useDeferredPayloadStatus";

const NO_ANNOTATION_NAMES: ReadonlyArray<string> = [];

const annotationNamesRefreshQuery = graphql`
  query useSpanAnnotationNamesRefreshQuery($id: ID!) {
    node(id: $id) {
      ... on Project {
        spanAnnotationNames
        traceAnnotationNames
      }
    }
  }
`;

/**
 * The project's span and trace annotation names, deferred in the table's owner
 * query. A names-only query refreshes them when `throttledFetchKey` changes,
 * and once after their payload fails. The names cover the whole project, so
 * the table's filter and time range do not refresh them.
 *
 * @param params - the owner query's project and request
 * @param params.project - the owner query's project, spreading this fragment
 * @param params.initialRequest - the owner query's request
 * @returns the names, and whether they failed to load or to refresh
 */
export function useSpanAnnotationNames({
  project,
  initialRequest,
}: {
  project: useSpanAnnotationNames_project$key;
  initialRequest: Observable<GraphQLResponse> | null | undefined;
}) {
  // Relay types the fields as present, but a deferred inline fragment reads
  // as undefined until its payload arrives.
  const {
    id,
    spanAnnotationNames,
    traceAnnotationNames,
  }: {
    id: string;
    spanAnnotationNames: ReadonlyArray<string> | undefined;
    traceAnnotationNames: ReadonlyArray<string> | undefined;
  } = readInlineData(
    graphql`
      fragment useSpanAnnotationNames_project on Project @inline {
        id
        spanAnnotationNames
        traceAnnotationNames
      }
    `,
    project
  );
  // Whether the owner query's names payload failed: Relay drops errors after
  // the first payload. `@catch` on the deferred fields would replace this.
  const { hasFailed, isPending } = useDeferredPayloadStatus({ initialRequest });
  const isNamesPayloadPending = spanAnnotationNames === undefined && isPending;
  const hasNamesPayloadFailed = spanAnnotationNames === undefined && hasFailed;
  // `fetchQuery` reports a failed refresh only to its subscriber. `@catch` on
  // the refresh query's fields would replace this.
  const [hasRefreshFailed, setHasRefreshFailed] = useState(false);
  const environment = useRelayEnvironment();
  const { throttledFetchKey } = useStreamState();
  const refreshKey = `${id}:${throttledFetchKey}`;
  const lastRefreshKeyRef = useRef(refreshKey);
  // The names query can outlast several refresh keys on a large project, and
  // the server keeps running a request the client aborts, so a refresh that
  // falls due while one is in flight is skipped. A server-side cache of the
  // names would remove this.
  const refreshSubscriptionRef = useRef<Subscription | null>(null);
  useEffect(() => {
    const isNewRefreshKey = lastRefreshKeyRef.current !== refreshKey;
    lastRefreshKeyRef.current = refreshKey;
    const isRefreshDue = isNewRefreshKey || hasNamesPayloadFailed;
    const isNamesRequestInFlight =
      isNamesPayloadPending || refreshSubscriptionRef.current != null;
    if (!isRefreshDue || isNamesRequestInFlight) {
      return;
    }
    fetchQuery(environment, annotationNamesRefreshQuery, { id }).subscribe({
      start: (subscription) => {
        refreshSubscriptionRef.current = subscription;
      },
      complete: () => {
        refreshSubscriptionRef.current = null;
        setHasRefreshFailed(false);
      },
      error: () => {
        refreshSubscriptionRef.current = null;
        setHasRefreshFailed(true);
      },
    });
  }, [
    environment,
    id,
    refreshKey,
    hasNamesPayloadFailed,
    isNamesPayloadPending,
  ]);
  useEffect(
    () => () => {
      refreshSubscriptionRef.current?.unsubscribe();
      refreshSubscriptionRef.current = null;
    },
    [environment, id]
  );
  return {
    spanAnnotationNames: spanAnnotationNames ?? NO_ANNOTATION_NAMES,
    traceAnnotationNames: traceAnnotationNames ?? NO_ANNOTATION_NAMES,
    hasAnnotationNamesError: hasNamesPayloadFailed || hasRefreshFailed,
  };
}
