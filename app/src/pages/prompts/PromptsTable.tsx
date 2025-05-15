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

import { Flex, Icon, Icons, Link, LinkButton } from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { TextCell } from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { PromptsTable_prompts$key } from "./__generated__/PromptsTable_prompts.graphql";
import { PromptsTablePromptsQuery } from "./__generated__/PromptsTablePromptsQuery.graphql";
import { PromptActionMenu } from "./PromptActionMenu";

const PAGE_SIZE = 100;

type PromptsTableProps = {
  query: PromptsTable_prompts$key;
};

export function PromptsTable(props: PromptsTableProps) {
  const navigate = useNavigate();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<PromptsTablePromptsQuery, PromptsTable_prompts$key>(
      graphql`
        fragment PromptsTable_prompts on Query
        @refetchable(queryName: "PromptsTablePromptsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
          prompts(first: $first, after: $after)
            @connection(key: "PromptsTable_prompts") {
            edges {
              prompt: node {
                id
                name
                description
                createdAt
                version {
                  createdAt
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
      data.prompts.edges.map((edge) => {
        return {
          lastUpdatedAt: edge.prompt.version.createdAt,
          ...edge.prompt,
        };
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
        header: "description",
        accessorKey: "description",
        cell: TextCell,
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "last updated",
        accessorKey: "lastUpdatedAt",
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              gap="size-100"
              justifyContent="end"
              width="100%"
            >
              <StopPropagation>
                <LinkButton
                  leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                  size="S"
                  aria-label="Open in playground"
                  to={`${row.original.id}/playground`}
                >
                  Playground
                </LinkButton>
              </StopPropagation>
              <PromptActionMenu
                promptId={row.original.id}
                onDeleted={() => {
                  refetch({}, { fetchPolicy: "network-only" });
                }}
              />
            </Flex>
          );
        },
      },
    ];
    return cols;
  }, [refetch]);
  const table = useReactTable({
    columns,
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
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      align={cell.column.columnDef.meta?.textAlign}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
