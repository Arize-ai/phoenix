import React, { ReactNode, useCallback, useMemo, useRef } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex } from "@arizeai/components";

import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONText } from "@phoenix/components/code/JSONText";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import type { PlaygroundDatasetExamplesTableFragment$key } from "./__generated__/PlaygroundDatasetExamplesTableFragment.graphql";
import { PlaygroundDatasetExamplesTableQuery } from "./__generated__/PlaygroundDatasetExamplesTableQuery.graphql";
import { PlaygroundDatasetExamplesTableRefetchQuery } from "./__generated__/PlaygroundDatasetExamplesTableRefetchQuery.graphql";

function LargeTextWrap({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        max-height: 300px;
        overflow-y: auto;
      `}
    >
      {children}
    </div>
  );
}

function JSONCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  return (
    <LargeTextWrap>
      <JSONText json={value} space={2} />
    </LargeTextWrap>
  );
}

const PAGE_SIZE = 100;

//un-memoized normal table body component - see memoized version below
function TableBody<T>({ table }: { table: Table<T> }) {
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => (
        <tr key={row.id}>
          {row.getVisibleCells().map((cell) => {
            return (
              <td
                key={cell.id}
                style={{
                  width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function PlaygroundDatasetExamplesTable({
  datasetId,
}: {
  datasetId: string;
}) {
  const instances = usePlaygroundContext((state) => state.instances);

  const { dataset } = useLazyLoadQuery<PlaygroundDatasetExamplesTableQuery>(
    graphql`
      query PlaygroundDatasetExamplesTableQuery($datasetId: GlobalID!) {
        dataset: node(id: $datasetId) {
          ...PlaygroundDatasetExamplesTableFragment
        }
      }
    `,
    { datasetId }
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    PlaygroundDatasetExamplesTableRefetchQuery,
    PlaygroundDatasetExamplesTableFragment$key
  >(
    graphql`
      fragment PlaygroundDatasetExamplesTableFragment on Dataset
      @refetchable(queryName: "PlaygroundDatasetExamplesTableRefetchQuery")
      @argumentDefinitions(
        datasetVersionId: { type: "GlobalID" }
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        examples(
          datasetVersionId: $datasetVersionId
          first: $first
          after: $after
        ) @connection(key: "PlaygroundDatasetExamplesTable_examples") {
          edges {
            example: node {
              id
              revision {
                input
                output
              }
            }
          }
        }
      }
    `,
    dataset
  );

  // Refetch the data when the dataset version changes
  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          input: revision.input,
          output: revision.output,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];

  const playgroundInstanceOutputColumns = useMemo(() => {
    return instances.map((instance, index) => ({
      id: instance.id.toString(),
      header: () => (
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={index} />
          <span>Output</span>
        </Flex>
      ),
      minSize: 500,
    }));
  }, [instances]);
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: JSONCell,
      minSize: 300,
    },
    {
      header: "reference output",
      accessorKey: "output",
      cell: ({ getValue }) => {
        return <JSONText json={getValue()} space={2} disableTitle />;
      },
      minSize: 300,
    },
    ...playgroundInstanceOutputColumns,
  ];
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
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

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
        table {
          min-width: 100%;
        }
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={(theme) => css(tableCSS(theme), borderedTableCSS)}
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
                  style={{
                    width: `calc(var(--header-${header?.id}-size) * 1px)`,
                  }}
                >
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
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : table.getState().columnSizingInfo.isResizingColumn ? (
          <MemoizedTableBody table={table} />
        ) : (
          <TableBody table={table} />
        )}
      </table>
    </div>
  );
}
