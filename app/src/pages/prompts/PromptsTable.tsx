import React, { useMemo, useRef, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { PromptsTable_datasets$key } from "./__generated__/PromptsTable_datasets.graphql";
import { PromptsTablePromptsQuery } from "./__generated__/PromptsTablePromptsQuery.graphql";

const PAGE_SIZE = 100;

type PromptsTableProps = {
  query: PromptsTable_datasets$key;
};

export function PromptsTable(props: PromptsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    PromptsTablePromptsQuery,
    PromptsTable_datasets$key
  >(
    graphql`
      fragment PromptsTable_datasets on Query
      @refetchable(queryName: "PromptsTablePromptsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
        sort: {
          type: "DatasetSort"
          defaultValue: { col: createdAt, dir: desc }
        }
      ) {
        datasets(first: $first, after: $after, sort: $sort)
          @connection(key: "PromptsTable_datasets") {
          edges {
            node {
              id
              name
              description
              metadata
              createdAt
              exampleCount
              experimentCount
            }
          }
        }
      }
    `,
    props.query
  );
  const tableData = useMemo(
    () => data.datasets.edges.map((edge) => edge.node),
    [data]
  );
  const fetchMoreOnBottomReached = React.useCallback(
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
  const table = useReactTable({
    columns: [
      {
        header: "name",
        accessorKey: "name",
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
    ],
    data: tableData,
    state: {
      sorting,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      ref={tableContainerRef}
    >
      <table css={selectableTableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort()
                          ? "cursor-pointer"
                          : "",
                        onClick: header.column.getToggleSortingHandler(),
                        style: {
                          textAlign: header.column.columnDef.meta?.textAlign,
                        },
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() ? (
                        <Icon
                          className="sort-icon"
                          svg={
                            header.column.getIsSorted() === "asc" ? (
                              <Icons.ArrowUpFilled />
                            ) : (
                              <Icons.ArrowDownFilled />
                            )
                          }
                        />
                      ) : null}
                    </div>
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
            {rows.map((row) => {
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <td
                        key={cell.id}
                        align={cell.column.columnDef.meta?.textAlign}
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
          </tbody>
        )}
      </table>
    </div>
  );
}
