import { graphql, readInlineData } from "react-relay";

import type { useSpanAnnotationNames_project$key } from "./__generated__/useSpanAnnotationNames_project.graphql";

const NO_ANNOTATION_NAMES: ReadonlyArray<string> = [];

/**
 * The project's span and trace annotation names for the spans and traces
 * tables, which spread this fragment with `@defer` so their rows render
 * without waiting for the names. Until the names arrive there are none; a
 * refetch keeps the names already loaded until its own payload replaces them.
 *
 * @param params - the table's project and its requests' outcome
 * @param params.project - the table's project
 * @param params.hasRequestFailed - whether a request that was to deliver the
 * names failed, from `useDeferredPartsFailure`
 */
export function useSpanAnnotationNames({
  project,
  hasRequestFailed,
}: {
  project: useSpanAnnotationNames_project$key;
  hasRequestFailed: boolean;
}) {
  // Relay types the fields as present, but a deferred inline fragment reads
  // as undefined until its payload arrives.
  const {
    spanAnnotationNames,
    traceAnnotationNames,
  }: {
    spanAnnotationNames: ReadonlyArray<string> | undefined;
    traceAnnotationNames: ReadonlyArray<string> | undefined;
  } = readInlineData(
    graphql`
      fragment useSpanAnnotationNames_project on Project @inline {
        spanAnnotationNames
        traceAnnotationNames
      }
    `,
    project
  );
  return {
    spanAnnotationNames: spanAnnotationNames ?? NO_ANNOTATION_NAMES,
    traceAnnotationNames: traceAnnotationNames ?? NO_ANNOTATION_NAMES,
    hasAnnotationNamesError:
      spanAnnotationNames === undefined && hasRequestFailed,
  };
}
