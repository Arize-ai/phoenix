import { useEffect, useRef } from "react";
import {
  fetchQuery,
  graphql,
  readInlineData,
  useRelayEnvironment,
} from "react-relay";
import type { GraphQLResponse, Observable } from "relay-runtime";

import { useTimeRangeSelectionKey } from "@phoenix/components/datetime";
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
 * query. A names-only query refreshes them when the table's filter, the picked
 * time range or `throttledFetchKey` changes, and once their payload fails.
 *
 * @param params - the owner query's project and request, and the table's filter
 * @param params.project - the owner query's project, spreading this fragment
 * @param params.initialRequest - the owner query's request
 * @param params.filterCondition - the table's applied filter
 * @returns the names, and whether their deferred payload failed
 */
export function useSpanAnnotationNames({
  project,
  initialRequest,
  filterCondition,
}: {
  project: useSpanAnnotationNames_project$key;
  initialRequest: Observable<GraphQLResponse> | null | undefined;
  filterCondition: string;
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
  const { hasFailed } = useDeferredPayloadStatus({ initialRequest });
  const hasAnnotationNamesError =
    spanAnnotationNames === undefined && hasFailed;
  const environment = useRelayEnvironment();
  const { throttledFetchKey } = useStreamState();
  const timeRangeSelectionKey = useTimeRangeSelectionKey();
  const refreshKey = JSON.stringify([
    id,
    filterCondition,
    timeRangeSelectionKey,
    throttledFetchKey,
  ]);
  const lastRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    const isNewRefreshKey = lastRefreshKeyRef.current !== refreshKey;
    lastRefreshKeyRef.current = refreshKey;
    if (!isNewRefreshKey && !hasAnnotationNamesError) {
      return undefined;
    }
    const subscription = fetchQuery(environment, annotationNamesRefreshQuery, {
      id,
    }).subscribe({});
    return () => subscription.unsubscribe();
  }, [environment, id, refreshKey, hasAnnotationNamesError]);
  return {
    spanAnnotationNames: spanAnnotationNames ?? NO_ANNOTATION_NAMES,
    traceAnnotationNames: traceAnnotationNames ?? NO_ANNOTATION_NAMES,
    hasAnnotationNamesError,
  };
}
