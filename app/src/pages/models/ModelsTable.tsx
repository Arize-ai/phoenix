import { useCallback, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Link } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { TextCell } from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { EditModelButton } from "@phoenix/pages/models/EditModelButton";
import { getProviderName } from "@phoenix/utils/generativeUtils";

import { ModelsTable_models$key } from "./__generated__/ModelsTable_models.graphql";
import { ModelsTableModelsQuery } from "./__generated__/ModelsTableModelsQuery.graphql";

const PAGE_SIZE = 100;

type ModelsTableProps = {
  query: ModelsTable_models$key;
};

export function ModelsTable(props: ModelsTableProps) {
  const navigate = useNavigate();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ModelsTableModelsQuery,
    ModelsTable_models$key
  >(
    graphql`
      fragment ModelsTable_models on Query
      @refetchable(queryName: "ModelsTableModelsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        models(first: $first, after: $after)
          @connection(key: "ModelsTable_models") {
          edges {
            model: node {
              id
              name
              provider
              namePattern
              providerKey
              createdAt
              updatedAt
              cost {
                input
                output
                cacheRead
                cacheWrite
                promptAudio
                completionAudio
              }
            }
          }
        }
      }
    `,
    props.query
  );

  const tableData = useMemo(
    () =>
      data.models.edges.map((edge) => {
        return edge.model;
      }),
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

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "name",
        accessorKey: "name",
        cell: ({ row }) => {
          return <Link to={`${row.original.id}`}>{row.original.name}</Link>;
        },
      },
      {
        header: "provider",
        accessorKey: "providerKey",
        cell: ({ row }) => {
          const providerKey = row.original.providerKey;
          if (!providerKey) {
            return <span>{row.original.provider || "Unknown"}</span>;
          }

          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={providerKey} height={18} />
              <span>{getProviderName(providerKey as ModelProvider)}</span>
            </Flex>
          );
        },
      },
      {
        header: "name pattern",
        accessorKey: "namePattern",
        cell: TextCell,
      },
      {
        header: "input cost",
        accessorKey: "cost.input",
        cell: ({ row }) => {
          const cost = row.original.cost?.input;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "output cost",
        accessorKey: "cost.output",
        cell: ({ row }) => {
          const cost = row.original.cost?.output;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "cache read cost",
        accessorKey: "cost.cacheRead",
        cell: ({ row }) => {
          const cost = row.original.cost?.cacheRead;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "cache write cost",
        accessorKey: "cost.cacheWrite",
        cell: ({ row }) => {
          const cost = row.original.cost?.cacheWrite;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "prompt audio cost",
        accessorKey: "cost.promptAudio",
        cell: ({ row }) => {
          const cost = row.original.cost?.promptAudio;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "completion audio cost",
        accessorKey: "cost.completionAudio",
        cell: ({ row }) => {
          const cost = row.original.cost?.completionAudio;
          return cost ? `$${cost.toPrecision(3)}` : "--";
        },
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => {
          return <EditModelButton modelId={row.original.id} />;
        },
      },
    ];
    return cols;
  }, []);

  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return (
      <div>
        <p>No models found.</p>
      </div>
    );
  }

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
                        ["aria-role"]: header.column.getCanSort()
                          ? "button"
                          : null,
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
        <tbody>
          {rows.map((row) => {
            return (
              <tr
                key={row.id}
                onClick={() => {
                  navigate(`${row.original.id}`);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    align={cell.column.columnDef.meta?.textAlign}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
