import { useEffect } from "react";
import {
  fetchQuery,
  graphql,
  readInlineData,
  useRelayEnvironment,
} from "react-relay";
import type { GraphQLResponse, Observable } from "relay-runtime";

import { INITIAL_FETCH_KEY } from "@phoenix/contexts/streamFetchKeys";
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
 * query and refreshed when `throttledFetchKey` changes.
 *
 * @param params - the owner query's project and request
 * @param params.project - the owner query's project, spreading this fragment
 * @param params.initialRequest - the owner query's request
 * @returns the names, and whether their deferred payload failed
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
  const { hasFailed } = useDeferredPayloadStatus({ initialRequest });
  const environment = useRelayEnvironment();
  const { throttledFetchKey } = useStreamState();
  useEffect(() => {
    // The owner query loads the names with the page.
    if (throttledFetchKey == null || throttledFetchKey === INITIAL_FETCH_KEY) {
      return undefined;
    }
    const subscription = fetchQuery(environment, annotationNamesRefreshQuery, {
      id,
    }).subscribe({});
    return () => subscription.unsubscribe();
  }, [environment, id, throttledFetchKey]);
  return {
    spanAnnotationNames: spanAnnotationNames ?? NO_ANNOTATION_NAMES,
    traceAnnotationNames: traceAnnotationNames ?? NO_ANNOTATION_NAMES,
    hasAnnotationNamesError: spanAnnotationNames === undefined && hasFailed,
  };
}
