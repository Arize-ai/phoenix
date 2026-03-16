import { css } from "@emotion/react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";

import { Icon, Icons, Text } from "@phoenix/components";
import { CopyButton } from "@phoenix/components/core/copy";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { CellWithControlsWrap } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type { DatasetHistoryTable_versions$key } from "./__generated__/DatasetHistoryTable_versions.graphql";

const PAGE_SIZE = 100;

type DatasetHistoryTableProps = {
  dataset: DatasetHistoryTable_versions$key;
};

export function DatasetHistoryTable(props: DatasetHistoryTableProps) {
  "use no memo";
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    graphql`
      fragment DatasetHistoryTable_versions on Dataset
      @refetchable(queryName: "DatasetHistoryTableVersionsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        versions(first: $first, after: $after)
          @connection(key: "DatasetHistoryTable_versions") {
          edges {
            node {
              id
              description
              createdAt
            }
          }
        }
      }
    `,
    props.dataset
  );
  const tableData = useMemo(
    () => data.versions.edges.map((edge) => edge.node),
    [data]
  );
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
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: [
      {
        header: "version ID",
        accessorKey: "id",
        size: 180,
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (!value) return <>{"--"}</>;
          return (
            <CellWithControlsWrap controls={<CopyButton text={value} />}>
              <Truncate>
                <Text fontFamily="mono">{value}</Text>
              </Truncate>
            </CellWithControlsWrap>
          );
        },
      },
      {
        header: "description",
        accessorKey: "description",
        size: 600,
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        size: 180,
        cell: TimestampCell,
      },
    ],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const getFlatHeaders = table.getFlatHeaders;
  const { columnSizing: columnSizingState } = table.getState();

  /**
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = React.useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizingState, getFlatHeaders]);

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      ref={tableContainerRef}
    >
      <table
        css={tableCSS}
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
                  colSpan={header.colSpan}
                  key={header.id}
                  style={{
                    width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      className={
                        header.column.getCanSort() ? "sort" : undefined
                      }
                      onClick={header.column.getToggleSortingHandler()}
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
                        style={{
                          width: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
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
          </tbody>
        )}
      </table>
    </div>
  );
}
