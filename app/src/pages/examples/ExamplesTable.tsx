import {
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
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Link } from "@phoenix/components/Link";
import { CompactJSONCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

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
  const latestVersion = useDatasetContext((state) => state.latestVersion);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ExamplesTableQuery, ExamplesTableFragment$key>(
      graphql`
        fragment ExamplesTableFragment on Dataset
        @refetchable(queryName: "ExamplesTableQuery")
        @argumentDefinitions(
          datasetVersionId: { type: "ID" }
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
          examples(
            datasetVersionId: $datasetVersionId
            first: $first
            after: $after
          ) @connection(key: "ExamplesTable_examples") {
            edges {
              example: node {
                id
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

  // Refetch the data when the dataset version changes
  useEffect(() => {
    startTransition(() => {
      refetch(
        { datasetVersionId: latestVersion?.id || null },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [latestVersion, refetch]);

  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          input: revision.input,
          output: revision.output,
          metadata: revision.metadata,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler(),
          }}
        />
      ),
      cell: ({ row }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      ),
    },
    {
      header: "example id",
      accessorKey: "id",
      cell: ({ getValue, row }) => {
        const exampleId = row.original.id;
        return <Link to={`${exampleId}`}>{getValue() as string}</Link>;
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
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
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
  const navigate = useNavigate();
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
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => {
                  navigate(`${row.original.id}`);
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
