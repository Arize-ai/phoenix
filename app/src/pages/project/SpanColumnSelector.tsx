import type { Column } from "@tanstack/react-table";
import { graphql, useFragment } from "react-relay";

import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { SpanColumnSelector_annotations$key } from "./__generated__/SpanColumnSelector_annotations.graphql";
import type { SpanColumnSelector_traceAnnotations$key } from "./__generated__/SpanColumnSelector_traceAnnotations.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  TRACE_ANNOTATIONS_COLUMN_ID,
  TRACE_ANNOTATIONS_COLUMN_LABEL,
} from "./tableUtils";
import { TracingColumnSelector } from "./TracingColumnSelector";

const UN_HIDABLE_COLUMN_IDS = ["spanKind", "name"];

type SpanColumnSelectorProps = {
  /**
   * All of the top-level columns of the span table (including group columns,
   * which represent the visible dynamic annotation columns)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  query: SpanColumnSelector_annotations$key &
    SpanColumnSelector_traceAnnotations$key;
};

/** The column selector for the span and trace tables. */
export function SpanColumnSelector({
  columns,
  query,
}: SpanColumnSelectorProps) {
  const annotationsData = useFragment<SpanColumnSelector_annotations$key>(
    graphql`
      fragment SpanColumnSelector_annotations on Project {
        spanAnnotationNames
      }
    `,
    query
  );
  const traceAnnotationsData =
    useFragment<SpanColumnSelector_traceAnnotations$key>(
      graphql`
        fragment SpanColumnSelector_traceAnnotations on Project {
          traceAnnotationsNames
        }
      `,
      query
    );

  const annotationColumnVisibility = useTracingContext(
    (state) => state.annotationColumnVisibility
  );
  const setAnnotationColumnVisibility = useTracingContext(
    (state) => state.setAnnotationColumnVisibility
  );
  const traceAnnotationColumnVisibility = useTracingContext(
    (state) => state.traceAnnotationColumnVisibility
  );
  const setTraceAnnotationColumnVisibility = useTracingContext(
    (state) => state.setTraceAnnotationColumnVisibility
  );

  return (
    <TracingColumnSelector
      columns={columns}
      unHidableColumnIds={UN_HIDABLE_COLUMN_IDS}
      columnLabels={{
        [TRACE_ANNOTATIONS_COLUMN_ID]: TRACE_ANNOTATIONS_COLUMN_LABEL,
      }}
      annotationKinds={[
        {
          names: getNonNoteAnnotationNames(annotationsData.spanAnnotationNames),
          visibility: annotationColumnVisibility,
          onVisibilityChange: setAnnotationColumnVisibility,
        },
        {
          names: getNonNoteAnnotationNames(
            traceAnnotationsData.traceAnnotationsNames
          ),
          visibility: traceAnnotationColumnVisibility,
          onVisibilityChange: setTraceAnnotationColumnVisibility,
          getLabel: (name) => `${name} (trace)`,
        },
      ]}
    />
  );
}
