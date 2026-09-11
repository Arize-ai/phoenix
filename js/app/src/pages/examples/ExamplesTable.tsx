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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";
import { useStore } from "zustand";

import {
  Button,
  CopyToClipboardButton,
  Icon,
  Icons,
  Input,
  TextField,
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
  getEditableTableCellValue,
} from "@phoenix/components/table";
import type { EditableTableStore } from "@phoenix/components/table";
import {
  ACTIONS_COLUMN_ID,
  ACTIONS_COLUMN_PINNING,
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  editableTableCSS,
  fixedRowHeightTableCSS,
  getCommonPinningStyles,
  selectableTableCSS,
  TABLE_DATA_CELL_CLASS,
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
import { ExamplesEditToolbar } from "./ExamplesEditToolbar";
import { ExampleSelectionToolbar } from "./ExampleSelectionToolbar";
import { getNewExampleTemplate } from "./newExampleTemplate";

const PAGE_SIZE = 100;

/**
 * The virtualizer positions rows from this estimate rather than measuring
 * them, so `fixedRowHeightTableCSS` holds every data cell to exactly this
 * height. Cell content is clamped to one ellipsized line; the full value is one
 * click away in the row's details.
 */
const ROW_HEIGHT = 52;

/** Custom property the fixed-height table style reads its row height from. */
const rowHeightStyle: Record<string, string> = {
  "--table-row-height": `${ROW_HEIGHT}px`,
};

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

const rowActionButtonCSS = css`
  white-space: nowrap;
`;

const removeRowButtonCSS = css(
  rowActionButtonCSS,
  css`
    color: var(--global-color-danger);
  `
);

// The ID column narrows to 60px; the field shrinks with the cell.
const newExampleIdFieldCSS = css`
  --field-min-width: 0;
`;

/**
 * Names an example the way a person would, for accessible names. The row's own
 * ID is a base64 global ID — or a temporary `new-…` ID — and reads as noise.
 */
const describeExample = ({
  row,
  externalId,
}: {
  row: DatasetExampleTableRow;
  externalId: string | null;
}): string =>
  row.isNew
    ? externalId
      ? `new example ${externalId}`
      : "new example"
    : `example ${externalId ?? row.id}`;

/**
 * The example's accessible name. A new example's custom ID lives in the edit
 * store while it is typed, so the name follows it from there.
 */
function useExampleLabel({
  row,
  editStore,
}: {
  row: DatasetExampleTableRow;
  editStore: EditableTableStore<DatasetExampleTableRow>;
}): string {
  return useStore(editStore, (state) =>
    describeExample({
      row,
      externalId: getEditableTableCellValue({
        state,
        rowId: row.id,
        columnId: "externalId",
        originalValue: row.externalId,
      }),
    })
  );
}

type EditableExampleColumnId = "input" | "output" | "metadata";

/** An example's JSON cell, named for assistive technology after its row. */
function ExampleJSONCell({
  columnId,
  editStore,
  ...context
}: CellContext<DatasetExampleTableRow, unknown> & {
  columnId: EditableExampleColumnId;
  editStore: EditableTableStore<DatasetExampleTableRow>;
}) {
  const rowLabel = useExampleLabel({ row: context.row.original, editStore });
  return (
    <EditableJSONCell
      {...context}
      columnId={columnId}
      requireObject
      title={
        context.row.original.isNew
          ? `Edit ${columnId} · new example`
          : `Edit ${columnId}`
      }
      rowLabel={rowLabel}
    />
  );
}

/** Selection is held as a list of example IDs; the table wants a lookup. */
const toRowSelection = (exampleIds: string[]): Record<string, boolean> =>
  Object.fromEntries(exampleIds.map((exampleId) => [exampleId, true]));

/**
 * The ID cell for a newly added example. The ID is optional: leaving it blank
 * lets the server auto-generate one, and typing overrides it with an external
 * ID. The duplicate-ID error is announced through `aria-describedby`; the fixed
 * row height leaves no room for a visible message.
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
      getEditableTableCellValue({
        state,
        rowId: row.id,
        columnId: "externalId",
        originalValue: row.externalId,
      }) ?? ""
  );
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  const isDuplicate = useStore(editStore, (state) =>
    getDuplicateExternalIdRowIds(state).includes(row.id)
  );
  const errorId = `${row.id}-custom-id-error`;
  return (
    <>
      <TextField
        size="S"
        css={newExampleIdFieldCSS}
        value={externalId}
        isDisabled={isSaving}
        isInvalid={isDuplicate}
        aria-label="Custom ID (leave blank to auto-generate)"
        aria-describedby={isDuplicate ? errorId : undefined}
        onChange={(nextValue) => {
          editStore.getState().updateCell({
            rowId: row.id,
            columnId: "externalId",
            value: nextValue === "" ? null : nextValue,
            originalValue: row.externalId,
          });
        }}
      >
        <Input placeholder="ID auto-generated" />
      </TextField>
      {isDuplicate ? (
        <VisuallyHidden>
          <span id={errorId}>{DUPLICATE_ID_ERROR}</span>
        </VisuallyHidden>
      ) : null}
    </>
  );
}

/**
 * Removes a row or restores a removed one. Removing a new row drops it
 * outright; an existing row is struck through until the changes are saved.
 */
function RowActionsCell({
  row,
  editStore,
}: {
  row: DatasetExampleTableRow;
  editStore: EditableTableStore<DatasetExampleTableRow>;
}) {
  const isDeleted = useStore(editStore, (state) =>
    state.deletedRowIds.has(row.id)
  );
  const label = useExampleLabel({ row, editStore });
  return isDeleted ? (
    <Button
      size="S"
      variant="quiet"
      css={rowActionButtonCSS}
      leadingVisual={<Icon svg={<Icons.RotateCcw />} />}
      aria-label={`Restore ${label}`}
      onPress={() => editStore.getState().restoreRow(row.id)}
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
        aria-label={`Remove ${label}`}
        onPress={() => editStore.getState().deleteRow(row.id)}
      >
        Remove
      </Button>
      <Tooltip>Removed when changes are saved</Tooltip>
    </TooltipTrigger>
  );
}

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
  // The virtualizer reads its scroll element during render, so the ref is
  // attached through state to force a re-render once the element exists. The
  // element is read only via `tableContainerRef`; the state value is unused.
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

  // The rows the last render showed. The post-save refetch compares against it
  // to tell whether the saved rows have rendered yet.
  const renderedData = useRef(data);
  useLayoutEffect(() => {
    renderedData.current = data;
  }, [data]);
  // Set when the post-save refetch has completed but its rows have not
  // rendered yet.
  const isAwaitingSavedRows = useRef(false);

  // Refetch when the dataset version or the filter changes.
  useEffect(() => {
    const dataBeforeRefetch = renderedData.current;
    startTransition(() => {
      refetch(
        {
          datasetVersionId: latestVersion?.id || null,
          filter,
          splitIds: selectedSplitIds,
        },
        {
          fetchPolicy: "store-and-network",
          // A save holds the table in "saving" until the committed rows have
          // rendered, so pending edits never flicker away before their saved
          // counterparts. The changes are committed either way: a failed
          // refetch ends the session on the rows already shown.
          onComplete: (error) => {
            if (editStore.getState().mode !== "saving") {
              return;
            }
            if (error || renderedData.current !== dataBeforeRefetch) {
              editStore.getState().finishSaving();
              return;
            }
            isAwaitingSavedRows.current = true;
          },
        }
      );
    });
  }, [editStore, latestVersion, filter, refetch, selectedSplitIds]);
  // Ends the session in the same frame the saved rows render.
  useLayoutEffect(() => {
    if (!isAwaitingSavedRows.current) {
      return;
    }
    isAwaitingSavedRows.current = false;
    if (editStore.getState().mode === "saving") {
      editStore.getState().finishSaving();
    }
  }, [data, editStore]);
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
        .reduce<ExamplesCache>((acc, example) => {
          acc[example.id] = example;
          return acc;
        }, {})
    );
  }, [data, selectedExampleIds, setExamplesCache]);
  const rowSelection = useMemo(
    () => toRowSelection(selectedExampleIds),
    [selectedExampleIds]
  );
  const setRowSelection = useCallback(
    (rowSelection: Updater<Record<string, boolean>>) => {
      setSelectedExampleIds((prevSelection) => {
        const nextSelection =
          typeof rowSelection === "function"
            ? rowSelection(toRowSelection(prevSelection))
            : rowSelection;
        return Object.entries(nextSelection)
          .filter(([, isSelected]) => isSelected)
          .map(([exampleId]) => exampleId);
      });
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
  const newExampleTemplate = useMemo(
    () => getNewExampleTemplate(tableData),
    [tableData]
  );
  const { selectRow } = useShiftClickRowSelection<DatasetExampleTableRow>({
    resetKey: tableData,
  });

  // New examples are prepended; the table scrolls to the top so the added row
  // is visible.
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
      {
        header: "splits",
        accessorKey: "splits",
        maxSize: 150,
        size: 30,
        minSize: 30,
        cell: ({ row }) => <DatasetSplits labels={row.original.splits} />,
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
              <ExampleJSONCell
                {...context}
                columnId={columnId}
                editStore={editStore}
              />
            )
          : CompactJSONCell<DatasetExampleTableRow, unknown>,
      }))
    );
    if (isEditing) {
      cols.push({
        id: ACTIONS_COLUMN_ID,
        header: "",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <RowActionsCell row={row.original} editStore={editStore} />
        ),
      });
    }
    return cols;
  }, [editStore, isEditing, selectRow]);

  const table = useReactTable<DatasetExampleTableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
      columnSizing,
      columnPinning: isEditing
        ? ACTIONS_COLUMN_PINNING
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
      editing: { store: editStore },
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
  // Stable while the row model is unchanged, so the virtualizer keeps its
  // measurements between renders.
  const getItemKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows]
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
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
  // A floating toolbar sits over the bottom of the scroll area, so leave room
  // beneath the last row for it to scroll clear of the toolbar.
  const hasFloatingToolbar = isEditing || selectedRows.length > 0;
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  // No pages load while a save is in flight: the refetch that ends the save is
  // the only data change the table waits for.
  const isSaving = mode === "saving";
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          !isSaving &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, isSaving, loadNext]
  );
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
        &[data-has-floating-toolbar="true"] {
          padding-bottom: var(--global-dimension-size-1000);
        }
      `}
      data-has-floating-toolbar={hasFloatingToolbar}
      ref={tableContainerCallbackRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={[
          isEditing ? editableTableCSS : selectableTableCSS,
          fixedRowHeightTableCSS,
        ]}
        style={{
          ...columnSizeVars,
          ...rowHeightStyle,
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
                    isEditing ? undefined : () => navigate(`${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const colSizeVar = `--col-${makeSafeColumnId(
                      cell.column.id
                    )}-size`;
                    return (
                      <td
                        key={cell.id}
                        className={TABLE_DATA_CELL_CLASS}
                        data-row-actions={
                          cell.column.id === ACTIONS_COLUMN_ID || undefined
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
      {isEditing ? (
        <ExamplesEditToolbar
          editStore={editStore}
          newExampleTemplate={newExampleTemplate}
        />
      ) : null}
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
