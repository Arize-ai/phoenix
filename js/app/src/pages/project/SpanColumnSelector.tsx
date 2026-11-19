import type { RowData } from "@tanstack/react-table";

import type { Column } from "@phoenix/components/table/tableFeatures";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  TRACE_ANNOTATIONS_COLUMN_ID,
  TRACE_ANNOTATIONS_COLUMN_LABEL,
  makeFlatAnnotationColumnId,
} from "./tableUtils";
import { TracingColumnSelector } from "./TracingColumnSelector";

const UN_HIDABLE_COLUMN_IDS = ["spanKind", "name"];

type SpanColumnSelectorProps<TData extends RowData> = {
  /**
   * All of the top-level columns of the span table, including visible dynamic
   * annotation columns.
   */
  columns: Column<TData>[];
  spanAnnotationNames: ReadonlyArray<string>;
  traceAnnotationNames: ReadonlyArray<string>;
  /** Whether the annotation names failed to load. */
  hasAnnotationNamesError: boolean;
};

/** The column selector for the span and trace tables. */
export function SpanColumnSelector<TData extends RowData>({
  columns,
  spanAnnotationNames,
  traceAnnotationNames,
  hasAnnotationNamesError,
}: SpanColumnSelectorProps<TData>) {
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
          names: getNonNoteAnnotationNames(spanAnnotationNames),
          namesError: hasAnnotationNamesError
            ? "Span annotation names failed to load."
            : null,
          visibility: annotationColumnVisibility,
          onVisibilityChange: setAnnotationColumnVisibility,
          targetType: "span",
          getColumnId: (name) => makeFlatAnnotationColumnId(name),
        },
        {
          names: getNonNoteAnnotationNames(traceAnnotationNames),
          namesError: hasAnnotationNamesError
            ? "Trace annotation names failed to load."
            : null,
          visibility: traceAnnotationColumnVisibility,
          onVisibilityChange: setTraceAnnotationColumnVisibility,
          targetType: "trace",
          getColumnId: (name) => makeFlatAnnotationColumnId(name, "trace"),
        },
      ]}
    />
  );
}
