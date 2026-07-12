import { css } from "@emotion/react";
import type { CellContext, ColumnDef, Updater } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  CopyToClipboardButton,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  Truncate,
  VisuallyHidden,
} from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { Link } from "@phoenix/components/core/Link";
import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import {
  CellWithControlsWrap,
  CompactJSONCell,
  createRowSelectionColumn,
  EditableJSONCell,
} from "@phoenix/components/table";
import type { EditableTableStore } from "@phoenix/components/table";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  editableTableCSS,
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { useShiftClickRowSelection } from "@phoenix/components/table/useShiftClickRowSelection";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import type { ExamplesCache } from "@phoenix/pages/examples/ExamplesFilterContext";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import type { Mutable } from "@phoenix/typeUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";
import type { ExamplesTableFragment$key } from "./__generated__/ExamplesTableFragment.graphql";
import type { ExamplesTableQuery } from "./__generated__/ExamplesTableQuery.graphql";
import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import {
  DUPLICATE_ID_ERROR,
  getDuplicateExternalIdRowIds,
} from "./duplicateExternalIds";
import { ExampleSelectionToolbar } from "./ExampleSelectionToolbar";

const PAGE_SIZE = 100;

/**
 * The virtualizer positions rows from this estimate rather than measuring them,
 * so it has to be the height every row actually occupies.
 */
const ROW_HEIGHT = 52;

/**
 * Holds every row to {@link ROW_HEIGHT}.
 *
 * The virtualizer never measures a row, so a row that renders taller than the
 * estimate drifts out from under its `translateY` slot and overlaps its
 * neighbours. A `height` on a `td` is only a *minimum* in table layout — the
 * cell grows to fit its content and there is never any overflow to clip — so
 * the content itself is what has to stay on one line.
 *
 * Two things in a cell want to wrap: the JSON preview (`JSONText` with a
 * `maxLength` renders a bare `<span>`, and the cell allows `overflow-wrap:
 * anywhere`) and the split chips (a wrapping flex list). Both are clamped to a
 * single ellipsized line; the full value is one click away in the row's
 * details, and the editable cell already reads this way.
 */
const fixedRowHeightCSS = css`
  tbody:not(.is-empty) > tr > td {
    height: ${ROW_HEIGHT}px;
  }
  tbody:not(.is-empty) > tr > td > span,
  tbody:not(.is-empty) > tr > td > pre {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tbody:not(.is-empty) > tr > td ul {
    flex-wrap: nowrap;
    overflow: hidden;
  }
`;

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

const rowActionButtonCSS = css`
  white-space: nowrap;
`;

/**
 * Names an example the way a person would, for accessible names. The row's own
 * ID is a base64 global ID — or a temporary `new-…` ID — and reads as noise.
 */
const describeExample = (row: DatasetExampleTableRow): string =>
  row.isNew
    ? row.externalId
      ? `new example ${row.externalId}`
      : "new example"
    : `example ${row.externalId ?? row.id}`;

/** Selection is held as a list of example IDs; the table wants a lookup. */
const toRowSelection = (exampleIds: string[]): Record<string, boolean> =>
  Object.fromEntries(exampleIds.map((exampleId) => [exampleId, true]));

// A cell-filling text input for a new example's ID. It reads as an editable
// field — a subtle border that brightens on hover/focus — so it's clear the
// ID can be overridden, while the italic placeholder communicates that an ID
// will be auto-generated when the field is left untouched.
//
// This is a raw input rather than the design system's TextField because the
// virtualizer pins every row to a fixed height: TextField stacks a label and a
// validation message around its input, which the row has no space for. The
// error is announced through `aria-describedby` instead.
const newExampleIdInputCSS = css`
  appearance: none;
  width: 100%;
  background: var(--global-input-field-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  outline: none;
  padding: var(--global-dimension-size-50) var(--global-dimension-size-75);
  margin: 0;
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-s);
  color: inherit;
  transition: border-color 0.15s ease-in-out;
  &:hover,
  &:focus {
    border-color: var(--global-input-field-border-color-active);
  }
  &::placeholder {
    color: var(--global-text-color-500);
    font-family: var(--global-font-family);
    font-style: italic;
  }
  &:disabled {
    opacity: 0.6;
  }
  &[aria-invalid="true"] {
    border-color: var(--global-color-danger);
  }
`;

/**
 * The ID cell for a newly added example. The ID is optional: leaving it blank
 * lets the server auto-generate one, and typing overrides it with an external
 * ID.
 */
function NewExampleIdCell({
  row,
  editStore,
}: {
  row: DatasetExampleTableRow;
  editStore: EditableTableStore<DatasetExampleTableRow>;
}) {
  const externalId = useStore(
    editStore,
    (state) =>
      state.addedRows.find((addedRow) => addedRow.id === row.id)?.externalId ??
      ""
  );
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  const duplicateRowIds = useStore(
    editStore,
    useShallow(getDuplicateExternalIdRowIds)
  );
  const isDuplicate = duplicateRowIds.includes(row.id);
  const errorId = `${row.id}-custom-id-error`;
  return (
    <>
      <input
        css={newExampleIdInputCSS}
        value={externalId}
        disabled={isSaving}
        placeholder="ID auto-generated"
        aria-label="Custom ID (leave blank to auto-generate)"
        aria-invalid={isDuplicate}
        aria-describedby={isDuplicate ? errorId : undefined}
        onChange={(event) => {
          const nextValue = event.target.value;
          editStore.getState().updateCell({
            rowId: row.id,
            columnId: "externalId",
            value: nextValue === "" ? null : nextValue,
            originalValue: null,
          });
        }}
      />
      {isDuplicate ? (
        <VisuallyHidden>
          <span id={errorId}>{DUPLICATE_ID_ERROR}</span>
        </VisuallyHidden>
      ) : null}
    </>
  );
}

const removeRowButtonCSS = css(
  rowActionButtonCSS,
  css`
    color: var(--global-color-danger);
  `
);

export function ExamplesTable({
  dataset,
  editStore,
}: {
  dataset: examplesLoaderQuery$data["dataset"];
  editStore: EditableTableStore<DatasetExampleTableRow>;
}) {
  "use no memo";
  const {
    filter,
    selectedExampleIds,
    setSelectedExampleIds,
    selectedSplitIds,
    examplesCache,
    setExamplesCache,
  } = useExamplesFilterContext();
  const navigate = useNavigate();
  const { exampleId: selectedExampleId } = useParams();
  const latestVersion = useDatasetContext((state) => state.latestVersion);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // The virtualizer reads its scroll element on render, so attaching the ref has
  // to re-render the table — a bare ref would leave the virtualizer measuring
  // nothing on the first paint. The element itself is only ever read through
  // `tableContainerRef`; this state exists purely to trigger that re-render.
  const [, setTableContainerElement] = useState<HTMLDivElement | null>(null);
  const tableContainerCallbackRef = useCallback(
    (element: HTMLDivElement | null) => {
      tableContainerRef.current = element;
      setTableContainerElement(element);
    },
    []
  );
  const [columnSizing, setColumnSizing] = useState({});
  const mode = useStore(editStore, (state) => state.mode);
  const addedRows = useStore(editStore, (state) => state.addedRows);
  const deletedRowIds = useStore(editStore, (state) => state.deletedRowIds);
  const isEditing = mode !== "read";
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ExamplesTableQuery, ExamplesTableFragment$key>(
      graphql`
        fragment ExamplesTableFragment on Dataset
        @refetchable(queryName: "ExamplesTableQuery")
        @argumentDefinitions(
          datasetVersionId: { type: "ID" }
          splitIds: { type: "[ID!]" }
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          filter: { type: "String", defaultValue: null }
        ) {
          examples(
            datasetVersionId: $datasetVersionId
            first: $first
            after: $after
            filter: $filter
            splitIds: $splitIds
          ) @connection(key: "ExamplesTable_examples") {
            edges {
              example: node {
                id
                externalId
                datasetSplits {
                  id
                  name
                  color
                }
                revision {
                  input
                  output
                  metadata
                }
              }
            }
          }
        }
      `,
      dataset
    );

  // Refetch the data when the dataset version changes or the filter changes
  useEffect(() => {
    startTransition(() => {
      refetch(
        {
          datasetVersionId: latestVersion?.id || null,
          filter,
          splitIds: selectedSplitIds,
        },
        {
          fetchPolicy: "store-and-network",
          onComplete: (error) => {
            // A save holds the table in "saving" until the committed rows come
            // back from the server, so the pending edits never flicker away
            // before their saved counterparts arrive. If the refetch fails,
            // hand editing back to the user rather than stranding the table.
            if (editStore.getState().mode !== "saving") {
              return;
            }
            if (error) {
              editStore.getState().stopSaving();
            } else {
              editStore.getState().finishSaving();
            }
          },
        }
      );
    });
  }, [editStore, latestVersion, filter, refetch, selectedSplitIds]);
  // sync selected examples into cache for later access
  useEffect(() => {
    setExamplesCache(
      data.examples.edges
        .map((example) => ({
          id: example.example.id,
          datasetSplits: example.example.datasetSplits as Mutable<
            typeof example.example.datasetSplits
          >,
        }))
        .filter((example) => selectedExampleIds.includes(example.id))
        .reduce((acc, example) => {
          acc[example.id] = example;
          return acc;
        }, {} as ExamplesCache)
    );
  }, [data, selectedExampleIds, setExamplesCache]);
  const rowSelection = useMemo(
    () => toRowSelection(selectedExampleIds),
    [selectedExampleIds]
  );
  const setRowSelection = useCallback(
    (rowSelection: Updater<Record<string, boolean>>) => {
      setSelectedExampleIds((prevSelection) =>
        Object.keys(
          typeof rowSelection === "function"
            ? rowSelection(toRowSelection(prevSelection))
            : rowSelection
        )
      );
    },
    [setSelectedExampleIds]
  );

  const tableData = useMemo(() => {
    const baselineRows: DatasetExampleTableRow[] = data.examples.edges.map(
      (edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          externalId: example.externalId ?? null,
          splits: example.datasetSplits,
          input: revision.input,
          output: revision.output,
          metadata: revision.metadata,
          isNew: false,
        };
      }
    );
    // Deleted rows stay visible (struck through) until the changes are saved.
    return [...addedRows, ...baselineRows];
  }, [addedRows, data]);
  const { selectRow } = useShiftClickRowSelection<DatasetExampleTableRow>({
    resetKey: tableData,
  });

  // New examples are prepended, so scroll them into view — otherwise pressing
  // "Add example" while scrolled down looks like it did nothing.
  const addedRowCount = addedRows.length;
  const previousAddedRowCount = useRef(addedRowCount);
  useEffect(() => {
    if (addedRowCount > previousAddedRowCount.current) {
      tableContainerRef.current?.scrollTo({ top: 0 });
    }
    previousAddedRowCount.current = addedRowCount;
  }, [addedRowCount]);

  const columns = useMemo(() => {
    const cols: ColumnDef<DatasetExampleTableRow>[] = [];
    if (!isEditing) {
      cols.push(
        createRowSelectionColumn<DatasetExampleTableRow>({
          selectRow,
          size: 30,
          minSize: 30,
          maxSize: 30,
        })
      );
    }
    cols.push(
      {
        header: "id",
        accessorKey: "id",
        maxSize: 180,
        size: 120,
        minSize: 60,
        cell: ({ row }) => {
          const exampleId = row.original.id;
          const displayId = row.original.externalId ?? exampleId;
          if (isEditing) {
            if (row.original.isNew) {
              return (
                <NewExampleIdCell row={row.original} editStore={editStore} />
              );
            }
            return <Truncate maxWidth="100%">{displayId}</Truncate>;
          }
          return (
            <CellWithControlsWrap
              controls={<CopyToClipboardButton text={displayId} />}
            >
              <Link
                to={`${exampleId}`}
                css={css`
                  width: 100%;
                `}
              >
                <Truncate maxWidth={"100%"}>{displayId}</Truncate>
              </Link>
            </CellWithControlsWrap>
          );
        },
      },
      ...(
        [
          { columnId: "input", size: 300 },
          { columnId: "output", size: 300 },
          { columnId: "metadata", size: 250 },
        ] as const
      ).map(({ columnId, size }) => ({
        header: columnId,
        accessorKey: columnId,
        size,
        // In read mode render the subscription-free compact cell; the editable
        // cell (which subscribes to the edit store) mounts only while editing.
        cell: isEditing
          ? (context: CellContext<DatasetExampleTableRow, unknown>) => (
              <EditableJSONCell
                {...context}
                columnId={columnId}
                requireObject
                title={
                  context.row.original.isNew
                    ? `Edit ${columnId} · new example`
                    : `Edit ${columnId}`
                }
                rowLabel={describeExample(context.row.original)}
              />
            )
          : CompactJSONCell<DatasetExampleTableRow, unknown>,
      }))
    );
    cols.splice(isEditing ? 1 : 2, 0, {
      header: "splits",
      accessorKey: "splits",
      maxSize: 150,
      size: 30,
      minSize: 30,
      cell: ({ row }) => <DatasetSplits labels={row.original.splits} />,
    });
    if (isEditing) {
      cols.push({
        id: "actions",
        header: "",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const isDeleted = deletedRowIds.has(row.original.id);
          return isDeleted ? (
            <Button
              size="S"
              variant="quiet"
              css={rowActionButtonCSS}
              leadingVisual={<Icon svg={<Icons.RotateCcw />} />}
              aria-label={`Restore ${describeExample(row.original)}`}
              onPress={() => editStore.getState().restoreRow(row.original.id)}
            >
              Restore
            </Button>
          ) : (
            <TooltipTrigger>
              <Button
                size="S"
                variant="quiet"
                css={removeRowButtonCSS}
                leadingVisual={<Icon svg={<Icons.Close />} />}
                aria-label={`Remove ${describeExample(row.original)}`}
                onPress={() => editStore.getState().deleteRow(row.original.id)}
              >
                Remove
              </Button>
              <Tooltip>Removed when changes are saved</Tooltip>
            </TooltipTrigger>
          );
        },
      });
    }
    return cols;
  }, [deletedRowIds, editStore, isEditing, selectRow]);

  const table = useReactTable<DatasetExampleTableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
      columnSizing,
      columnPinning: isEditing
        ? { right: ["actions"] }
        : CHECKBOX_COLUMN_PINNING,
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    // ensure row IDs are the example IDs and not the index
    getRowId: (row) => row.id,
    meta: {
      editing: {
        store: editStore,
        getRowId: (row) => row.id,
        // Rows pending deletion are read-only until restored
        isCellEditable: ({ row }) => !deletedRowIds.has(row.id),
      },
    },
  });

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;

  /**
   * Calculate all column sizes at once as CSS variables for performance
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return colSizes;
    // Disabled lint as per tanstack docs linked above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState, columns]);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const spacerRowHeight = useMemo(
    () =>
      totalHeight -
      virtualRows.reduce(
        (renderedHeight, virtualRow) => renderedHeight + virtualRow.size,
        0
      ),
    [totalHeight, virtualRows]
  );
  const isEmpty = rows.length === 0;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedExamples = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      ref={tableContainerCallbackRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={[
          isEditing ? editableTableCSS : selectableTableCSS,
          fixedRowHeightCSS,
        ]}
        style={{
          ...columnSizeVars,
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{
                    ...getCommonPinningStyles(header.column),
                    width: `calc(var(--header-${makeSafeColumnId(
                      header.id
                    )}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <>
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                      <div
                        {...{
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
                          className: `resizer ${
                            header.column.getIsResizing() ? "isResizing" : ""
                          }`,
                        }}
                      />
                    </>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmptyWrap>
            <EmptyState
              graphic={<EmptyStateGraphic variant="genericAdd" />}
              description="No examples found"
            />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {virtualRows.map((virtualRow, virtualRowIndex) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }
              const isSelected =
                !isEditing && row.original.id === selectedExampleId;
              const isDeleted = isEditing && deletedRowIds.has(row.original.id);
              return (
                <tr
                  key={row.id}
                  data-selected={isSelected}
                  data-deleted={isDeleted}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${
                      virtualRow.start - virtualRowIndex * virtualRow.size
                    }px)`,
                  }}
                  onClick={
                    isEditing || row.original.isNew
                      ? undefined
                      : () => navigate(`${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const colSizeVar = `--col-${makeSafeColumnId(
                      cell.column.id
                    )}-size`;
                    return (
                      <td
                        key={cell.id}
                        data-row-actions={
                          cell.column.id === "actions" || undefined
                        }
                        onClick={(e) => {
                          // prevent the row click event from firing on the select cell
                          if (cell.column.id === CHECKBOX_COLUMN_ID) {
                            e.stopPropagation();
                            selectRow({ event: e, row, table });
                          }
                        }}
                        style={{
                          ...getCommonPinningStyles(cell.column),
                          width: `calc(var(${colSizeVar}) * 1px)`,
                          maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                          overflowWrap: "anywhere",
                          // prevent text selection on the select cell
                          userSelect:
                            cell.column.id === CHECKBOX_COLUMN_ID
                              ? "none"
                              : undefined,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Reserves the scroll height of the rows the virtualizer did not
                render — it is layout, not data, so it stays out of the a11y tree. */}
            <tr aria-hidden>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                style={{ height: `${spacerRowHeight}px`, padding: 0 }}
              />
            </tr>
          </tbody>
        )}
      </table>
      {!isEditing && selectedRows.length ? (
        <ExampleSelectionToolbar
          selectedExamples={selectedExamples}
          examplesCache={examplesCache}
          onClearSelection={clearSelection}
          onExamplesDeleted={() => {
            refetch({}, { fetchPolicy: "store-and-network" });
          }}
        />
      ) : null}
    </div>
  );
}
