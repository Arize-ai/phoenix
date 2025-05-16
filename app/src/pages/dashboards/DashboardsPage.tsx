import { useMemo, useRef } from "react";
import { useLoaderData } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  LinkButton,
  Tab,
  TabList,
  Tabs,
  View,
} from "@phoenix/components";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { dashboardsLoader } from "./dashboardsLoader";
import { ProjectDashboardsTable } from "./ProjectDashboardsTable";

// Inline DashboardsTable component
export type Dashboard = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  lastUpdatedAt: string;
};

function DashboardsTable({ dashboards }: { dashboards: Dashboard[] }) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  type TableRow = Dashboard;
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        header: "name",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link to={`/dashboards/${row.original.id}`}>{row.original.name}</Link>
        ),
      },
      {
        header: "description",
        accessorKey: "description",
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
    ],
    []
  );
  const table = useReactTable({
    columns,
    data: dashboards,
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
              <tr
                key={row.id}
                onClick={() =>
                  window.location.assign(`/dashboards/${row.original.id}`)
                }
                css={css`
                  cursor: pointer;
                `}
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
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

export function DashboardsPage() {
  const loaderData = useLoaderData<typeof dashboardsLoader>();
  // For now, use mock data for dashboards
  const dashboards = [
    {
      id: "1",
      name: "Sales Dashboard",
      description: "Tracks sales KPIs",
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Marketing Dashboard",
      description: "Monitors marketing campaigns",
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    },
  ];
  return (
    <Flex direction="column" height="100%">
      <View padding="size-200" flex="none">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={1}>Dashboards</Heading>
          <LinkButton
            size="M"
            leadingVisual={<Icon svg={<Icons.BarChartOutline />} />}
            variant="primary"
            to="#"
          >
            Create Dashboard
          </LinkButton>
        </Flex>
      </View>
      <Tabs>
        <TabList>
          <Tab id="project-dashboards">Project Dashboards</Tab>
          <Tab id="user-dashboards">Custom Dashboards</Tab>
        </TabList>
        <LazyTabPanel id="project-dashboards">
          <ProjectDashboardsTable query={loaderData} />
        </LazyTabPanel>
        <LazyTabPanel id="user-dashboards">
          <DashboardsTable dashboards={dashboards} />
        </LazyTabPanel>
      </Tabs>
    </Flex>
  );
}
