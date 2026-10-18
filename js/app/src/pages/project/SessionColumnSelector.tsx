import type { RowData } from "@tanstack/react-table";
import { graphql, useFragment } from "react-relay";

import type { Column } from "@phoenix/components/table/tableFeatures";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { SessionColumnSelector_annotations$key } from "./__generated__/SessionColumnSelector_annotations.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import { makeFlatAnnotationColumnId } from "./tableUtils";
import { TracingColumnSelector } from "./TracingColumnSelector";

const UN_HIDABLE_COLUMN_IDS = ["sessionId"];

type SessionColumnSelectorProps<TData extends RowData> = {
  /**
   * All of the top-level columns of the session table, including visible
   * dynamic annotation columns.
   */
  columns: Column<TData>[];
  query: SessionColumnSelector_annotations$key;
};

/** The column selector for the session table. */
export function SessionColumnSelector<TData extends RowData>({
  columns,
  query,
}: SessionColumnSelectorProps<TData>) {
  const data = useFragment<SessionColumnSelector_annotations$key>(
    graphql`
      fragment SessionColumnSelector_annotations on Project {
        sessionAnnotationNames
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

  return (
    <TracingColumnSelector
      columns={columns}
      unHidableColumnIds={UN_HIDABLE_COLUMN_IDS}
      annotationKinds={[
        {
          // The summary fragment behind the cells excludes "note" annotations,
          // so a note column would render permanently blank.
          names: getNonNoteAnnotationNames(data.sessionAnnotationNames),
          visibility: annotationColumnVisibility,
          onVisibilityChange: setAnnotationColumnVisibility,
          targetType: "session",
          getColumnId: (name) => makeFlatAnnotationColumnId(name),
        },
      ]}
    />
  );
}
