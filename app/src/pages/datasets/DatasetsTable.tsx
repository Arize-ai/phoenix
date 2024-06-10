import React, { useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Icon, Icons, Text } from "@arizeai/components";

import { Link } from "@phoenix/components";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DatasetsTable_datasets$key } from "./__generated__/DatasetsTable_datasets.graphql";
import { DatasetActionMenu } from "./DatasetActionMenu";

const PAGE_SIZE = 100;

type DatasetsTableProps = {
  query: DatasetsTable_datasets$key;
};

export function DatasetsTable(props: DatasetsTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment(
      graphql`
        fragment DatasetsTable_datasets on Query
        @refetchable(queryName: "DatasetsTableDatasetsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
          datasets(first: $first, after: $after)
            @connection(key: "DatasetsTable_datasets") {
            edges {
              node {
                id
                name
                description
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
        cell: ({ row }) => {
          return (
            <Link to={`${row.original.id}`}>
              <Text textSize="xlarge" color="inherit">
                {row.original.name}
              </Text>
            </Link>
          );
        },
      },
      {
        header: "description",
        accessorKey: "description",
      },
      {
        header: "example count",
        accessorKey: "exampleCount",
      },
      {
        header: "experiment count",
        accessorKey: "experimentCount",
      },
      {
        header: "",
        id: "actions",
        size: 10,
        cell: ({ row }) => {
          return (
            <DatasetActionMenu
              datasetId={row.original.id}
              datasetName={row.original.name}
              onDatasetDelete={() => {
                notifySuccess({
                  title: "Dataset deleted",
                  message: `${row.original.name} has been successfully deleted.`,
                });
                refetch({}, { fetchPolicy: "store-and-network" });
              }}
              onDatasetDeleteError={(error) => {
                notifyError({
                  title: "Dataset deletion failed",
                  message: error.message,
                });
              }}
            />
          );
        },
      },
    ],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                          left: header.getStart(),
                          width: header.getSize(),
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
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
