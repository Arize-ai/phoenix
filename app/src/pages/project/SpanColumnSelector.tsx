import { css } from "@emotion/react";
import type { Column } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Checkbox,
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
   * which are filtered out of the checkbox list but participate in ordering)
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
      <Popover>
        <SpanColumnSelectorMenu {...props} />
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A section of extra (non-reorderable) columns — annotations, trace
 * annotations — rendered below the core column list. Styled to line up with
 * the {@link ColumnSelectorMenu} rows: same horizontal inset, a hairline
 * divider on top, and a quiet uppercase section label.
 */
const columnSelectorSectionCSS = css`
  padding: 0 var(--global-dimension-static-size-50);
  margin-top: var(--global-dimension-static-size-50);
  border-top: 1px solid var(--global-border-color-default);
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
`;

const columnSelectorSectionHeaderCSS = css`
  padding-top: var(--global-dimension-static-size-50);
`;

const columCheckboxItemCSS = css`
  display: flex;
  align-items: center;
  min-height: var(--global-dimension-static-size-400);
  padding: 0 var(--global-dimension-static-size-100);
  border-radius: var(--global-rounding-small);
  label {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-static-size-100);
    min-width: 0;
  }
  &:hover {
    background-color: var(--global-color-gray-200);
  }
`;

function SpanColumnSelectorMenu(props: SpanColumnSelectorProps) {
  const { columns: propsColumns } = props;

  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnVisibility = useTracingContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useTracingContext((state) => state.columnOrder);
  const setColumnOrder = useTracingContext((state) => state.setColumnOrder);

  // Full top-level order (minus the pinned checkbox column) in display order
  const orderedTopLevelIds = mergeColumnOrder({
    columnOrder,
    columnIds: propsColumns
      .map((column) => column.id)
      .filter((id) => id !== CHECKBOX_COLUMN_ID),
  });

  const columnsById = new Map(
    propsColumns.map((column) => [column.id, column])
  );
  const selectorColumns = orderedTopLevelIds.flatMap((id) => {
    const column = columnsById.get(id);
    // Group columns (dynamic annotation columns) are managed by the
    // annotation sections below
    if (column == null || column.columns.length > 0) {
      return [];
    }
    return [
      {
        id,
        label: getColumnDisplayName(column),
        isVisibilityToggleDisabled: UN_HIDABLE_COLUMN_IDS.includes(id),
      },
    ];
  });

  const onColumnOrderChange = (orderedSubset: string[]) => {
    setColumnOrder(
      applySubsetColumnOrder({
        columnOrder: orderedTopLevelIds,
        orderedSubset,
      })
    );
  };

  return (
    <ColumnSelectorMenu
      columns={selectorColumns}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      onColumnOrderChange={onColumnOrderChange}
      toggleAllLabel="span columns"
    >
      <EvaluationColumnSelector {...props} />
      <TraceEvaluationColumnSelector {...props} />
    </ColumnSelectorMenu>
  );
}

function EvaluationColumnSelector({
  query,
}: Pick<SpanColumnSelectorProps, "query">) {
  const data = useFragment<SpanColumnSelector_annotations$key>(
    graphql`
      fragment SpanColumnSelector_annotations on Project {
        spanAnnotationNames
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
  const filteredSpanAnnotationNames = getNonNoteAnnotationNames(
    data.spanAnnotationNames
  );

  const allVisible = useMemo(() => {
    return filteredSpanAnnotationNames.every((name) => {
      const stateValue = annotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [filteredSpanAnnotationNames, annotationColumnVisibility]);

  const someVisible = useMemo(() => {
    return filteredSpanAnnotationNames.some((name) => {
      const stateValue = annotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [filteredSpanAnnotationNames, annotationColumnVisibility]);

  const onToggleAnnotations = useCallback(() => {
    const newVisibilityState = filteredSpanAnnotationNames.reduce(
      (acc, name) => {
        return { ...acc, [name]: !allVisible };
      },
      {}
    );
    setAnnotationColumnVisibility(newVisibilityState);
  }, [filteredSpanAnnotationNames, setAnnotationColumnVisibility, allVisible]);

  if (filteredSpanAnnotationNames.length === 0) {
    return null;
  }

  return (
    <section css={columnSelectorSectionCSS}>
      <div css={columnSelectorSectionHeaderCSS}>
        <div css={columCheckboxItemCSS}>
          <Checkbox
            name="toggle-annotations-all"
            isSelected={allVisible}
            isIndeterminate={someVisible && !allVisible}
            onChange={onToggleAnnotations}
          >
            annotations
          </Checkbox>
        </div>
      </div>
      <ul>
        {filteredSpanAnnotationNames.map((name) => {
          const isVisible = annotationColumnVisibility[name] ?? false;
          return (
            <li key={name} css={columCheckboxItemCSS}>
              <Checkbox
                name={name}
                isSelected={isVisible}
                onChange={(isSelected) =>
                  setAnnotationColumnVisibility({
                    ...annotationColumnVisibility,
                    [name]: isSelected,
                  })
                }
              >
                {name}
              </Checkbox>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TraceEvaluationColumnSelector({
  query,
}: Pick<SpanColumnSelectorProps, "query">) {
  const data = useFragment<SpanColumnSelector_traceAnnotations$key>(
    graphql`
      fragment SpanColumnSelector_traceAnnotations on Project {
        traceAnnotationsNames
      }
    `,
    query
  );
  const traceAnnotationColumnVisibility = useTracingContext(
    (state) => state.traceAnnotationColumnVisibility
  );
  const setTraceAnnotationColumnVisibility = useTracingContext(
    (state) => state.setTraceAnnotationColumnVisibility
  );
  const nonNoteAnnotationNames = getNonNoteAnnotationNames(
    data.traceAnnotationsNames
  );
  const allVisible = useMemo(() => {
    return nonNoteAnnotationNames.every((name) => {
      const stateValue = traceAnnotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [nonNoteAnnotationNames, traceAnnotationColumnVisibility]);

  const someVisible = useMemo(() => {
    return nonNoteAnnotationNames.some((name) => {
      const stateValue = traceAnnotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [nonNoteAnnotationNames, traceAnnotationColumnVisibility]);

  const onToggleTraceAnnotations = useCallback(() => {
    const newVisibilityState = nonNoteAnnotationNames.reduce((acc, name) => {
      return { ...acc, [name]: !allVisible };
    }, {});
    setTraceAnnotationColumnVisibility(newVisibilityState);
  }, [nonNoteAnnotationNames, setTraceAnnotationColumnVisibility, allVisible]);

  if (nonNoteAnnotationNames.length === 0) {
    return null;
  }

  return (
    <section css={columnSelectorSectionCSS}>
      <div css={columnSelectorSectionHeaderCSS}>
        <div css={columCheckboxItemCSS}>
          <Checkbox
            name="toggle-trace-annotations-all"
            isSelected={allVisible}
            isIndeterminate={someVisible && !allVisible}
            onChange={onToggleTraceAnnotations}
          >
            trace annotations
          </Checkbox>
        </div>
      </div>
      <ul>
        {nonNoteAnnotationNames.map((name) => {
          const isVisible = traceAnnotationColumnVisibility[name] ?? false;
          return (
            <li key={name} css={columCheckboxItemCSS}>
              <Checkbox
                name={name}
                isSelected={isVisible}
                onChange={(isSelected) =>
                  setTraceAnnotationColumnVisibility({
                    ...traceAnnotationColumnVisibility,
                    [name]: isSelected,
                  })
                }
              >
                {name}
              </Checkbox>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
