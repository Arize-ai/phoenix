import type { Column } from "@tanstack/react-table";
import { graphql, useFragment } from "react-relay";

import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { SessionColumnSelector_annotations$key } from "./__generated__/SessionColumnSelector_annotations.graphql";
import { TracingColumnSelector } from "./TracingColumnSelector";

const UN_HIDABLE_COLUMN_IDS = ["sessionId"];

type SessionColumnSelectorProps = {
  /**
   * All of the top-level columns of the session table (including group columns,
   * which represent the visible dynamic annotation columns)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  query: SessionColumnSelector_annotations$key;
};

/** The column selector for the session table. */
export function SessionColumnSelector({
  columns,
  query,
}: SessionColumnSelectorProps) {
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
          names: [...data.sessionAnnotationNames],
          visibility: annotationColumnVisibility,
          onVisibilityChange: setAnnotationColumnVisibility,
        },
      ]}
    />
  );
}
