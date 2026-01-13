import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
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
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import {
  ExamplesCache,
  useExamplesFilterContext,
} from "@phoenix/pages/examples/ExamplesFilterContext";
import { Mutable } from "@phoenix/typeUtils";

import { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";
import type { ExamplesTableFragment$key } from "./__generated__/ExamplesTableFragment.graphql";
import { ExamplesTableQuery } from "./__generated__/ExamplesTableQuery.graphql";
import { ExampleSelectionToolbar } from "./ExampleSelectionToolbar";

const PAGE_SIZE = 100;

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
    setExamplesCache,
  } = useExamplesFilterContext();
  const latestVersion = useDatasetContext((state) => state.latestVersion);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastSelectedRowIndexRef = useRef<number | null>(null);
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
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <IndeterminateCheckboxCell
            {...{
              isSelected: table.getIsAllRowsSelected(),
              isIndeterminate: table.getIsSomeRowsSelected(),
              onChange: table.toggleAllRowsSelected,
            }}
          />
        ),
        cell: ({ row }) => (
          <IndeterminateCheckboxCell
            {...{
              isSelected: row.getIsSelected(),
              isDisabled: !row.getCanSelect(),
              isIndeterminate: row.getIsSomeSelected(),
              onChange: row.toggleSelected,
            }}
          />
        ),
      },
      {
        header: "example id",
        accessorKey: "id",
        cell: ({ getValue, row }) => {
          const exampleId = row.original.id;
          return (
            <Link to={`${exampleId}`} onClick={(e) => e.stopPropagation()}>
              {getValue() as string}
            </Link>
          );
        },
      },
      {
        header: "input",
        accessorKey: "input",
        cell: CompactJSONCell,
      },
      {
        header: "output",
        accessorKey: "output",
        cell: CompactJSONCell,
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        cell: CompactJSONCell,
      },
    ];
    cols.splice(2, 0, {
      header: "splits",
      accessorKey: "splits",
      cell: ({ row }) => <DatasetSplits labels={row.original.splits} />,
    });
    return cols;
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    // ensure row IDs are the example IDs and not the index
    getRowId: (row) => row.id,
  });
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
      <table css={selectableTableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  <div>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : (
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={(e) => {
                  if (!e.shiftKey) {
                    lastSelectedRowIndexRef.current = rowIndex;
                  }
                  row.toggleSelected();
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
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
          onClearSelection={clearSelection}
          onExamplesDeleted={() => {
            refetch({}, { fetchPolicy: "store-and-network" });
          }}
        />
      ) : null}
    </div>
  );
}
