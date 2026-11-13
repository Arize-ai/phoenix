import { useCallback, useEffect, useState } from "react";
import { graphql, readInlineData } from "react-relay";
import type { GraphQLResponse, Observable } from "relay-runtime";

import type { useSpanAnnotationNames_project$key } from "./__generated__/useSpanAnnotationNames_project.graphql";

const NO_SPAN_ANNOTATION_NAMES: ReadonlyArray<string> = [];

/**
 * The project's span annotation names for the spans and traces tables, which
 * spread this fragment with `@defer` so their rows render without waiting for
 * the names. Until the names arrive there are none; a refetch keeps the names
 * already loaded until its own payload replaces them.
 *
 * Relay does not report a failure that arrives after a response's first part,
 * so the failure is read from the requests: the owner query's, and each of the
 * table's refetches through `onRequestComplete`.
 *
 * @param params - the table's project and its first request
 * @param params.project - the table's project
 * @param params.initialRequest - the owner query's request, read for a failure
 * after the rows render
 */
export function useSpanAnnotationNames({
  project,
  initialRequest,
}: {
  project: useSpanAnnotationNames_project$key;
  initialRequest: Observable<GraphQLResponse> | null | undefined;
}) {
  // Relay types the field as present, but a deferred inline fragment reads
  // as undefined until its payload arrives.
  const {
    spanAnnotationNames,
  }: { spanAnnotationNames: ReadonlyArray<string> | undefined } =
    readInlineData(
      graphql`
        fragment useSpanAnnotationNames_project on Project @inline {
          spanAnnotationNames
        }
      `,
      project
    );
  const [hasRequestFailed, setHasRequestFailed] = useState(false);
  useEffect(() => {
    const subscription = initialRequest?.subscribe({
      error: () => setHasRequestFailed(true),
    });
    return () => subscription?.unsubscribe();
  }, [initialRequest]);
  const onRequestComplete = useCallback(
    (error: Error | null) => setHasRequestFailed(error != null),
    []
  );
  return {
    spanAnnotationNames: spanAnnotationNames ?? NO_SPAN_ANNOTATION_NAMES,
    hasSpanAnnotationNamesError:
      spanAnnotationNames === undefined && hasRequestFailed,
    onRequestComplete,
  };
}
