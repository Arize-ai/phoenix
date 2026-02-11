import {
  type MouseEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Updater,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import { Link } from "@phoenix/components/Link";
import { CompactJSONCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { addRangeToSelection } from "@phoenix/components/table/selectionUtils";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import {
  ExamplesCache,
  useExamplesFilterContext,
} from "@phoenix/pages/examples/ExamplesFilterContext";
import { Mutable } from "@phoenix/typeUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";
import type { ExamplesTableFragment$key } from "./__generated__/ExamplesTableFragment.graphql";
import { ExamplesTableQuery } from "./__generated__/ExamplesTableQuery.graphql";
import { ExampleSelectionToolbar } from "./ExampleSelectionToolbar";

const PAGE_SIZE = 100;

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

export function ExamplesTable({
  dataset,
}: {
  dataset: examplesLoaderQuery$data["dataset"];
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
  const latestVersion = useDatasetContext((state) => state.latestVersion);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastSelectedRowIndexRef = useRef<number | null>(null);
  const [columnSizing, setColumnSizing] = useState({});
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
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [latestVersion, filter, refetch, selectedSplitIds]);
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
  const rowSelection = useMemo(() => {
    return selectedExampleIds.reduce(
      (acc, id) => {
        acc[id] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [selectedExampleIds]);
  const setRowSelection = useCallback(
    (rowSelection: Updater<Record<string, boolean>>) => {
      setSelectedExampleIds((prevSelection) => {
        if (typeof rowSelection === "function") {
          return Object.keys(
            rowSelection(
              prevSelection.reduce(
                (acc, id) => {
                  acc[id] = true;
                  return acc;
                },
                {} as Record<string, boolean>
              )
            )
          );
        }
        return Object.keys(rowSelection);
      });
    },
    [setSelectedExampleIds]
  );

  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          splits: example.datasetSplits,
          input: revision.input,
          output: revision.output,
          metadata: revision.metadata,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];

  // Reset the shift-click anchor when table data changes
  // to prevent stale index references after refetch
  useEffect(() => {
    lastSelectedRowIndexRef.current = null;
  }, [tableData]);

  /**
   * Shared row selection handler that handles both normal clicks and shift-clicks.
   * - Always updates lastSelectedRowIndexRef to the current row index
   * - If shift+click with a previous anchor, calls addRangeToSelection for range selection
   * - Otherwise toggles the single row's selection
   */
  const handleRowSelection = useCallback(
    (
      event: MouseEvent,
      rowIndex: number,
      toggleSelected: (value?: boolean) => void
    ) => {
      if (event.shiftKey && lastSelectedRowIndexRef.current !== null) {
        // Shift-click: select range from anchor to current row
        setRowSelection((prev) =>
          addRangeToSelection(
            tableData,
            lastSelectedRowIndexRef.current!,
            rowIndex,
            prev
          )
        );
      } else {
        // Normal click: toggle single row
        toggleSelected();
      }
      // Always update the anchor point
      lastSelectedRowIndexRef.current = rowIndex;
    },
    [setRowSelection, tableData]
  );

  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        id: "select",
        enableResizing: false,
        size: 30,
        minSize: 30,
        maxSize: 30,
        header: ({ table }) => (
          <IndeterminateCheckboxCell
            {...{
              isSelected: table.getIsAllRowsSelected(),
              isIndeterminate: table.getIsSomeRowsSelected(),
              onChange: table.toggleAllRowsSelected,
            }}
          />
        ),
        cell: ({ row, table }) => {
          const rowIndex = table
            .getRowModel()
            .rows.findIndex((r) => r.id === row.id);
          return (
            <IndeterminateCheckboxCell
              {...{
                isSelected: row.getIsSelected(),
                isDisabled: !row.getCanSelect(),
                isIndeterminate: row.getIsSomeSelected(),
                onChange: row.toggleSelected,
                onCellClick: (event: React.MouseEvent) => {
                  handleRowSelection(event, rowIndex, row.toggleSelected);
                },
              }}
            />
          );
        },
      },
      {
        header: "example id",
        accessorKey: "id",
        size: 180,
        cell: ({ getValue, row }) => {
          const exampleId = row.original.id;
          return <Link to={`${exampleId}`}>{getValue() as string}</Link>;
        },
      },
      {
        header: "input",
        accessorKey: "input",
        size: 300,
        cell: CompactJSONCell,
      },
      {
        header: "output",
        accessorKey: "output",
        size: 300,
        cell: CompactJSONCell,
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        size: 250,
        cell: CompactJSONCell,
      },
    ];
    cols.splice(2, 0, {
      header: "splits",
      accessorKey: "splits",
      size: 150,
      cell: ({ row }) => <DatasetSplits labels={row.original.splits} />,
    });
    return cols;
  }, [handleRowSelection]);

  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
      columnSizing,
      columnPinning: {
        left: ["select"],
      },
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    // ensure row IDs are the example IDs and not the index
    getRowId: (row) => row.id,
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
  }, [getFlatHeaders, columnSizingInfo, columnSizingState]);
  const rows = table.getRowModel().rows;
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
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={selectableTableCSS}
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
                    width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
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
          <TableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => navigate(`${row.original.id}`)}>
                {row.getVisibleCells().map((cell) => {
                  const colSizeVar = `--col-${makeSafeColumnId(cell.column.id)}-size`;
                  return (
                    <td
                      key={cell.id}
                      onClick={(e) => {
                        // prevent the row click event from firing on the select cell
                        if (cell.column.columnDef.id === "select") {
                          e.stopPropagation();
                          handleRowSelection(e, row.index, row.toggleSelected);
                        }
                      }}
                      style={{
                        ...getCommonPinningStyles(cell.column),
                        width: `calc(var(${colSizeVar}) * 1px)`,
                        maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                        // prevent text selection on the select cell
                        userSelect:
                          cell.column.columnDef.id === "select"
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
            ))}
          </tbody>
        )}
      </table>
      {selectedRows.length ? (
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
