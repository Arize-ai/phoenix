import type { Column } from "@tanstack/react-table";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
} from "@phoenix/components";
import {
  applySubsetColumnOrder,
  CHECKBOX_COLUMN_ID,
  ColumnSelectorMenu,
  mergeColumnOrder,
} from "@phoenix/components/table";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { SpanColumnSelector_annotations$key } from "./__generated__/SpanColumnSelector_annotations.graphql";
import type { SpanColumnSelector_traceAnnotations$key } from "./__generated__/SpanColumnSelector_traceAnnotations.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  TRACE_ANNOTATIONS_COLUMN_ID,
  TRACE_ANNOTATIONS_COLUMN_LABEL,
} from "./tableUtils";
const UN_HIDABLE_COLUMN_IDS = ["spanKind", "name"];

function getColumnDisplayName(column: Column<unknown>): string {
  if (column.id === TRACE_ANNOTATIONS_COLUMN_ID) {
    return TRACE_ANNOTATIONS_COLUMN_LABEL;
  }
  const header = column.columnDef.header;
  if (typeof header === "string") {
    return header;
  }
  return column.id;
}

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

export function SpanColumnSelector(props: SpanColumnSelectorProps) {
  return (
    <DialogTrigger>
      <Button>
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.Column />} />
          Columns
        </Flex>
      </Button>
      <Popover placement="bottom end">
        <SpanColumnSelectorMenu {...props} />
      </Popover>
    </DialogTrigger>
  );
}

/** How a row in the flat column list maps back to tracing store state. */
type ColumnKind = "column" | "spanAnnotation" | "traceAnnotation";

function SpanColumnSelectorMenu(props: SpanColumnSelectorProps) {
  const { columns: propsColumns, query } = props;

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
  const spanAnnotationNames = getNonNoteAnnotationNames(
    annotationsData.spanAnnotationNames
  );
  const traceAnnotationNames = getNonNoteAnnotationNames(
    traceAnnotationsData.traceAnnotationsNames
  );

  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnVisibility = useTracingContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useTracingContext((state) => state.columnOrder);
  const setColumnOrder = useTracingContext((state) => state.setColumnOrder);
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

  const columnsById = new Map(
    propsColumns.map((column) => [column.id, column])
  );
  const tableColumnIds = propsColumns
    .map((column) => column.id)
    .filter((id) => id !== CHECKBOX_COLUMN_ID);
  const spanAnnotationIds = new Set(spanAnnotationNames);
  // A trace annotation whose name collides with a span annotation cannot be
  // addressed separately (the table derives the same column id for both), so
  // the span annotation row wins
  const traceAnnotationIds = new Set(
    traceAnnotationNames.filter((name) => !spanAnnotationIds.has(name))
  );

  // One flat order over everything: table columns (visible annotation columns
  // are already among them as group columns) plus hidden annotation columns,
  // which keep their persisted position even while not rendered in the table
  const fullColumnOrder = mergeColumnOrder({
    columnOrder,
    columnIds: [
      ...tableColumnIds,
      ...spanAnnotationNames,
      ...traceAnnotationNames,
    ],
  });

  const kindById = new Map<string, ColumnKind>();
  const selectorColumns = fullColumnOrder.flatMap((id) => {
    const column = columnsById.get(id);
    if (column != null && column.columns.length === 0) {
      kindById.set(id, "column");
      return [
        {
          id,
          label: getColumnDisplayName(column),
          isVisibilityToggleDisabled: UN_HIDABLE_COLUMN_IDS.includes(id),
        },
      ];
    }
    if (spanAnnotationIds.has(id)) {
      kindById.set(id, "spanAnnotation");
      return [{ id, label: id }];
    }
    if (traceAnnotationIds.has(id)) {
      kindById.set(id, "traceAnnotation");
      return [{ id, label: `${id} (trace)` }];
    }
    return [];
  });

  // Annotation columns default to hidden, unlike regular columns, so their
  // visibility must be explicit in the merged map
  const mergedColumnVisibility: Record<string, boolean> = {
    ...columnVisibility,
  };
  for (const name of spanAnnotationIds) {
    mergedColumnVisibility[name] = annotationColumnVisibility[name] ?? false;
  }
  for (const name of traceAnnotationIds) {
    mergedColumnVisibility[name] =
      traceAnnotationColumnVisibility[name] ?? false;
  }

  const onColumnVisibilityChange = (
    newColumnVisibility: Record<string, boolean>
  ) => {
    const columnUpdates: Record<string, boolean> = {};
    const spanAnnotationUpdates = { ...annotationColumnVisibility };
    const traceAnnotationUpdates = { ...traceAnnotationColumnVisibility };
    for (const [id, isVisible] of Object.entries(newColumnVisibility)) {
      switch (kindById.get(id)) {
        case "spanAnnotation":
          spanAnnotationUpdates[id] = isVisible;
          break;
        case "traceAnnotation":
          traceAnnotationUpdates[id] = isVisible;
          break;
        default:
          columnUpdates[id] = isVisible;
      }
    }
    setColumnVisibility(columnUpdates);
    setAnnotationColumnVisibility(spanAnnotationUpdates);
    setTraceAnnotationColumnVisibility(traceAnnotationUpdates);
  };

  const onColumnOrderChange = (orderedSubset: string[]) => {
    setColumnOrder(
      applySubsetColumnOrder({
        columnOrder: fullColumnOrder,
        orderedSubset,
      })
    );
  };

  return (
    <ColumnSelectorMenu
      columns={selectorColumns}
      columnVisibility={mergedColumnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      onColumnOrderChange={onColumnOrderChange}
    />
  );
}
