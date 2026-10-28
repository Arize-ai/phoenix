import type { SortingState } from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Link } from "react-router";

import { Icon, Icons } from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  EvaluatorAverageCost,
  EvaluatorCost,
} from "@phoenix/components/evaluators/EvaluatorCost";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import type { ServerProjectEvaluatorsTableQuery } from "@phoenix/pages/evaluators/projectEvaluators/__generated__/ServerProjectEvaluatorsTableQuery.graphql";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorFailuresCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFailuresCell";
import { ProjectEvaluatorLagCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLagCell";
import { ProjectEvaluatorLoadCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLoadCell";
import { ProjectEvaluatorQueueCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueCell";
import { ProjectEvaluatorStatusCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStatusCell";

type QueryData = ServerProjectEvaluatorsTableQuery["response"];
type TableRow = QueryData["projectEvaluators"]["edges"][number]["node"];

/** Every project evaluator on the server is loaded; sorting happens here. */
const PROJECT_EVALUATORS_LIMIT = 1000;

function getProjectEvaluatorDetailsPath(row: TableRow): string {
  return `/projects/${encodeURIComponent(row.project.id)}/evaluators/${encodeURIComponent(row.id)}`;
}

/**
 * Every project evaluator on the server, across projects, so the ones taking
 * the shared queue's bandwidth can be found and turned off from one place.
 */
export function ServerProjectEvaluatorsTable({
  filter,
  fetchKey,
}: {
  /** Matches an evaluator's name or its project's name. */
  filter: string;
  /** Changes when the queue was changed from this page, to refetch at once. */
  fetchKey: number;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<ServerProjectEvaluatorsTableQuery>(
    graphql`
      query ServerProjectEvaluatorsTableQuery(
        $first: Int!
        $timeRange: TimeRange!
      ) {
        projectEvaluators(first: $first) {
          edges {
            node {
              id
              name
              enabled
              project {
                id
                name
              }
              evaluator {
                kind
              }
              runSummary {
                status
                lastRunAt
                queuedCount
                runningCount
                evaluatedCount
                failedCount
                droppedCount
                oldestQueuedAt
              }
              evaluationLoad {
                evaluationCount
                meanEvaluationSeconds
                shareOfEvaluationTime
              }
              failureSummary(timeRange: $timeRange) {
                failedCount
                evaluatedCount
                failureRate
                lastFailedAt
                lastError
              }
              lag(timeRange: $timeRange) {
                p50Seconds
                p95Seconds
                p99Seconds
              }
              traceProject {
                id
                traceCount(timeRange: $timeRange)
                costSummary(timeRange: $timeRange) {
                  total {
                    cost
                  }
                  prompt {
                    cost
                  }
                  completion {
                    cost
                  }
                }
              }
            }
          }
        }
      }
    `,
    { first: PROJECT_EVALUATORS_LIMIT, timeRange: timeRangeISOStrings },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const trimmedFilter = filter.trim().toLowerCase();
  const rows = useMemo(() => {
    const nodes = data.projectEvaluators.edges.map((edge) => edge.node);
    if (trimmedFilter.length === 0) {
      return nodes;
    }
    return nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(trimmedFilter) ||
        node.project.name.toLowerCase().includes(trimmedFilter)
    );
  }, [data, trimmedFilter]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "queue", desc: true },
  ]);
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        id: "enabled",
        header: "enabled",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <StopPropagation>
            <ProjectEvaluatorEnabledSwitch
              projectEvaluatorId={row.original.id}
              name={row.original.name}
              enabled={row.original.enabled}
              clearableCount={
                row.original.runSummary.queuedCount -
                row.original.runSummary.runningCount
              }
            />
          </StopPropagation>
        ),
      },
      {
        id: "name",
        header: "name",
        size: 200,
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <Link to={getProjectEvaluatorDetailsPath(row.original)}>
            <Truncate maxWidth="100%">{row.original.name}</Truncate>
          </Link>
        ),
      },
      {
        id: "project",
        header: "project",
        size: 180,
        accessorFn: (row) => row.project.name,
        cell: ({ row }) => (
          <Link
            to={`/projects/${encodeURIComponent(row.original.project.id)}/evaluators`}
          >
            <Truncate maxWidth="100%">{row.original.project.name}</Truncate>
          </Link>
        ),
      },
      {
        id: "status",
        header: "status",
        size: 120,
        accessorFn: (row) => row.runSummary.status,
        cell: ({ row }) => (
          <ProjectEvaluatorStatusCell runSummary={row.original.runSummary} />
        ),
      },
      {
        id: "queue",
        header: "queued",
        size: 110,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        accessorFn: (row) => row.runSummary.queuedCount,
        cell: ({ row }) => (
          <ProjectEvaluatorQueueCell queuedWork={row.original.runSummary} />
        ),
      },
      {
        id: "lag",
        header: "lag p95",
        size: 96,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        sortUndefined: "last",
        accessorFn: (row) => row.lag?.p95Seconds,
        cell: ({ row }) => <ProjectEvaluatorLagCell lag={row.original.lag} />,
      },
      {
        id: "load",
        header: "load",
        size: 80,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        sortUndefined: "last",
        accessorFn: (row) =>
          row.evaluationLoad.shareOfEvaluationTime ?? undefined,
        cell: ({ row }) => (
          <ProjectEvaluatorLoadCell
            evaluationLoad={row.original.evaluationLoad}
          />
        ),
      },
      {
        id: "failures",
        header: "failure rate",
        size: 110,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        sortUndefined: "last",
        accessorFn: (row) => row.failureSummary.failureRate ?? undefined,
        cell: ({ row }) => (
          <ProjectEvaluatorFailuresCell
            failureSummary={row.original.failureSummary}
          />
        ),
      },
      {
        id: "cost",
        header: "total cost",
        size: 110,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        sortUndefined: "last",
        accessorFn: (row) =>
          row.traceProject.costSummary.total.cost ?? undefined,
        cell: ({ row }) => (
          <EvaluatorCost
            evaluatorKind={row.original.evaluator.kind}
            costSummary={row.original.traceProject.costSummary}
          />
        ),
      },
      {
        id: "averageCost",
        header: "avg cost / run",
        size: 130,
        meta: { textAlign: "right" },
        sortDescFirst: true,
        sortUndefined: "last",
        accessorFn: (row) => {
          const cost = row.traceProject.costSummary.total.cost;
          const runCount = row.traceProject.traceCount;
          return cost != null && runCount > 0 ? cost / runCount : undefined;
        },
        cell: ({ row }) => (
          <EvaluatorAverageCost
            evaluatorKind={row.original.evaluator.kind}
            costSummary={row.original.traceProject.costSummary}
            runCount={row.original.traceProject.traceCount}
          />
        ),
      },
    ],
    []
  );
  const table = useTable({
    features: appTableFeatures,
    data: rows as TableRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
  });
  const tableRows = table.getRowModel().rows;
  return (
    <table css={tableCSS} aria-label="Project evaluators across all projects">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  style={{
                    width: header.getSize(),
                    textAlign: header.column.columnDef.meta?.textAlign,
                  }}
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  <div
                    className={header.column.getCanSort() ? "sort" : undefined}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {sorted ? (
                      <Icon
                        className="sort-icon"
                        svg={
                          sorted === "asc" ? (
                            <Icons.CaretUpFilled />
                          ) : (
                            <Icons.CaretDownFilled />
                          )
                        }
                      />
                    ) : null}
                  </div>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      {tableRows.length === 0 ? (
        <TableEmptyWrap>
          <CompactEmptyState
            icon={<Icon svg={<Icons.Scale />} />}
            description="No project evaluators"
            isFiltered={trimmedFilter.length > 0}
          />
        </TableEmptyWrap>
      ) : (
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    maxWidth: cell.column.getSize(),
                    overflow: "hidden",
                    textAlign: cell.column.columnDef.meta?.textAlign,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}
