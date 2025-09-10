import { useCallback, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Link } from "@phoenix/components/Link";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import { ProjectDashboardsTable_projects$key } from "./__generated__/ProjectDashboardsTable_projects.graphql";

const PAGE_SIZE = 50;

export function ProjectDashboardsTable({
  query,
}: {
  query: ProjectDashboardsTable_projects$key;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    graphql`
      fragment ProjectDashboardsTable_projects on Query
      @refetchable(queryName: "ProjectDashboardsTableProjectsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        projects(first: $first, after: $after)
          @connection(key: "ProjectDashboardsTable_projects") {
          edges {
            project: node {
              id
              name
            }
          }
        }
      }
    `,
    query
  );

  const projects = useMemo(
    () =>
      data.projects.edges.map(
        (edge: NonNullable<(typeof data.projects.edges)[number]>) =>
          edge.project
      ),
    [data]
  );

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
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

  const columns = useMemo<ColumnDef<(typeof projects)[number]>[]>(
    () => [
      {
        header: "Project",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link to={`/dashboards/projects/${row.original.id}`}>
            {row.original.name}
          </Link>
        ),
      },
    ],
    []
  );
  const table = useReactTable({
    columns,
    data: projects,
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
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    align={cell.column.columnDef.meta?.textAlign}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
