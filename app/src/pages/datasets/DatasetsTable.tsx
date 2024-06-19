import React, {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

import { Link } from "@phoenix/components";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DatasetsTable_datasets$key } from "./__generated__/DatasetsTable_datasets.graphql";
import {
  DatasetSort,
  DatasetsTableDatasetsQuery,
} from "./__generated__/DatasetsTableDatasetsQuery.graphql";
import { DatasetActionMenu } from "./DatasetActionMenu";

const PAGE_SIZE = 100;

type DatasetsTableProps = {
  query: DatasetsTable_datasets$key;
};

function toGqlSort(sort: SortingState[number]): DatasetSort {
  const col = sort.id;
  if (col !== "createdAt" && col !== "name") {
    throw new Error("Invalid sort column");
  }
  return {
    col,
    dir: sort.desc ? "desc" : "asc",
  };
}

export function DatasetsTable(props: DatasetsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      DatasetsTableDatasetsQuery,
      DatasetsTable_datasets$key
    >(
      graphql`
        fragment DatasetsTable_datasets on Query
        @refetchable(queryName: "DatasetsTableDatasetsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          sort: {
            type: "DatasetSort"
            defaultValue: { col: createdAt, dir: desc }
          }
        ) {
          datasets(first: $first, after: $after, sort: $sort)
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
          const hasExperiments = row.original.experimentCount > 0;
          const to = hasExperiments
            ? `${row.original.id}/experiments`
            : `${row.original.id}/examples`;
          return <Link to={to}>{row.original.name}</Link>;
        },
      },
      {
        header: "description",
        accessorKey: "description",
        enableSorting: false,
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "example count",
        accessorKey: "exampleCount",
        enableSorting: false,
      },
      {
        header: "experiment count",
        accessorKey: "experimentCount",
        enableSorting: false,
      },
      {
        header: "",
        id: "actions",
        enableSorting: false,
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
    state: {
      sorting,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
  });

  useEffect(() => {
    //if the sorting changes, we need to reset the pagination
    const sort = sorting[0];

    startTransition(() => {
      refetch(
        {
          sort: sort ? toGqlSort(sort) : { col: "createdAt", dir: "desc" },
          after: null,
          first: PAGE_SIZE,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [sorting, refetch]);
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
                    const hasExperiments = row.original.experimentCount > 0;
                    const to = hasExperiments
                      ? `${row.original.id}/experiments`
                      : `${row.original.id}/examples`;
                    navigate(to);
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
