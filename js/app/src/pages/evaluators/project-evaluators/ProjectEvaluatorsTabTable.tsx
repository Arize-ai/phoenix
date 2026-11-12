import { css } from "@emotion/react";
import type {
  OnChangeFn,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Icon, Icons, Link, Text } from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeRange } from "@phoenix/components/datetime";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { EvaluatorSelectionToolbar } from "@phoenix/components/evaluators/EvaluatorSelectionToolbar";
import { ProjectLink } from "@phoenix/components/project/ProjectLink";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  CHECKBOX_COLUMN_ID,
  createRowSelectionColumn,
  useShiftClickRowSelection,
} from "@phoenix/components/table";
import { ColumnHeaderWithHelp } from "@phoenix/components/table/ColumnHeaderWithHelp";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableColumnHeader } from "@phoenix/components/table/TableColumnHeader";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import type { ProjectEvaluatorsTabTableQuery } from "@phoenix/pages/evaluators/project-evaluators/__generated__/ProjectEvaluatorsTabTableQuery.graphql";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";
import { getClearableCount } from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import {
  ProjectEvaluatorAverageCost,
  ProjectEvaluatorCost,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorCost";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorFailuresCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFailuresCell";
import { ProjectEvaluatorLagCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLagCell";
import { ProjectEvaluatorLoadCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLoadCell";
import { ProjectEvaluatorQueueCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueCell";
import { ProjectEvaluatorStatusCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStatusCell";
import { ProjectEvaluatorTargetIcon } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetIcon";

type QueryData = ProjectEvaluatorsTabTableQuery["response"];
type TableRow = QueryData["projectEvaluators"]["edges"][number]["node"];

/** Every project evaluator on the server is loaded; sorting happens here. */
const PROJECT_EVALUATORS_LIMIT = 1000;

/**
 * While the server queue is Degraded, the evaluators driving it: the fewest
 * that together hold most of it, each holding a sizable part on its own.
 */
const DRIVERS_CUMULATIVE_SHARE = 0.8;
const DRIVER_MIN_SHARE = 0.1;

/** An evaluator's part of the server queue, at most all of it. */
function getEvaluatorShareOfServerQueue({
  evaluatorQueuedCount,
  serverQueuedCount,
}: {
  evaluatorQueuedCount: number;
  serverQueuedCount: number;
}): number {
  return serverQueuedCount > 0
    ? Math.min(1, evaluatorQueuedCount / serverQueuedCount)
    : 0;
}

function getServerQueueDriverIds({
  rows,
  serverQueuedCount,
}: {
  rows: ReadonlyArray<{ id: string; runSummary: { queuedCount: number } }>;
  serverQueuedCount: number;
}): Set<string> {
  const drivers = new Set<string>();
  if (serverQueuedCount <= 0) {
    return drivers;
  }
  const ranked = [...rows].sort(
    (a, b) => b.runSummary.queuedCount - a.runSummary.queuedCount
  );
  let cumulative = 0;
  for (const row of ranked) {
    const share = getEvaluatorShareOfServerQueue({
      evaluatorQueuedCount: row.runSummary.queuedCount,
      serverQueuedCount,
    });
    if (cumulative >= DRIVERS_CUMULATIVE_SHARE || share < DRIVER_MIN_SHARE) {
      break;
    }
    drivers.add(row.id);
    cumulative += share;
  }
  return drivers;
}

const shareFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});

const shareCellCSS = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--global-dimension-size-100);
  .queue-share__track {
    flex: none;
    width: 48px;
    height: 6px;
    border-radius: 2px;
    background-color: var(--global-color-gray-200);
    overflow: hidden;
  }
  .queue-share__bar {
    height: 100%;
    background-color: var(--global-color-gray-600);
  }
  &[data-driver="true"] .queue-share__bar {
    background-color: var(--global-color-warning);
  }
`;

function ServerQueueShareCell({
  share,
  isDriver,
}: {
  share: number | null;
  isDriver: boolean;
}) {
  if (share == null || share === 0) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  return (
    <div css={shareCellCSS} data-driver={isDriver}>
      <div className="queue-share__track">
        <div
          className="queue-share__bar"
          style={{ width: `${Math.min(share, 1) * 100}%` }}
        />
      </div>
      <Text fontFamily="mono" color={isDriver ? "warning" : undefined}>
        {share < 0.01 ? "<1%" : shareFormatter.format(share)}
      </Text>
    </div>
  );
}

function getProjectEvaluatorDetailsPath(row: TableRow): string {
  return `/projects/${encodeURIComponent(row.project.id)}/evaluators/${encodeURIComponent(row.id)}`;
}

/**
 * Every project evaluator on the server, across projects, so the ones taking
 * the shared queue's bandwidth can be found and turned off from one place.
 */
export function ProjectEvaluatorsTabTable({
  filter,
  projectIds,
  fetchKey,
  sorting,
  onSortingChange,
  onEvaluatorsDeleted,
}: {
  /** Matches an evaluator's name or its project's name. */
  filter: string;
  /** Only these projects' evaluators; all when empty. */
  projectIds: ReadonlyArray<string>;
  /** Changes when the queue was changed from this page, to refetch at once. */
  fetchKey: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  /** Called once selected evaluators are deleted, to refetch the page. */
  onEvaluatorsDeleted: () => void;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const data = useLazyLoadQuery<ProjectEvaluatorsTabTableQuery>(
    graphql`
      query ProjectEvaluatorsTabTableQuery(
        $first: Int!
        $timeRange: TimeRange!
      ) {
        evaluationQueue {
          status
          queuedCount
        }
        projectEvaluators(first: $first) {
          edges {
            node {
              id
              name
              enabled
              evaluationTarget
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
                clearedCount
                oldestWaitingOrRetryingAt
              }
              tracingEnabled
              evaluationLoad {
                evaluationCount
                meanEvaluationSeconds
                shareOfEvaluationTime
                excludesUntracedEvaluators
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
  const nodes = data.projectEvaluators.edges.map((edge) => edge.node);
  // Picks naming a deleted project are ignored, as the charts ignore them.
  const projectIdsWithEvaluators = new Set(
    nodes.map((node) => node.project.id)
  );
  const picked = new Set(
    projectIds.filter((id) => projectIdsWithEvaluators.has(id))
  );
  const rows = nodes
    .filter((node) => picked.size === 0 || picked.has(node.project.id))
    .filter(
      (node) =>
        trimmedFilter.length === 0 ||
        node.name.toLowerCase().includes(trimmedFilter) ||
        node.project.name.toLowerCase().includes(trimmedFilter)
    );
  const serverQueuedCount = data.evaluationQueue.queuedCount;
  const driverIds =
    data.evaluationQueue.status === "DEGRADED"
      ? getServerQueueDriverIds({
          rows: data.projectEvaluators.edges.map((edge) => edge.node),
          serverQueuedCount,
        })
      : new Set<string>();
  // Only shown rows count, so a filter that hides a selected row also keeps
  // it out of a delete.
  const selectedEvaluators = rows
    .filter((row) => rowSelection[row.id])
    .map((row) => ({ id: row.id, name: row.name, kind: row.evaluator.kind }));
  const { selectRow } = useShiftClickRowSelection<TableRow>({
    resetKey: data,
  });
  const columns: ColumnDef<TableRow>[] = [
    createRowSelectionColumn<TableRow>({ selectRow }),
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
            clearableCount={getClearableCount(row.original.runSummary)}
          />
        </StopPropagation>
      ),
    },
    {
      id: "kind",
      header: "kind",
      size: 80,
      accessorFn: (row) => row.evaluator.kind,
      cell: ({ row }) => (
        <EvaluatorKindToken kind={row.original.evaluator.kind} />
      ),
    },
    {
      id: "name",
      header: "name",
      size: 200,
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <Flex direction="row" gap="size-100" alignItems="center">
          <ProjectEvaluatorTargetIcon target={row.original.evaluationTarget} />
          <Link to={getProjectEvaluatorDetailsPath(row.original)}>
            <Truncate maxWidth="100%">{row.original.name}</Truncate>
          </Link>
        </Flex>
      ),
    },
    {
      id: "project",
      header: "project",
      size: 180,
      accessorFn: (row) => row.project.name,
      cell: ({ row }) => (
        <ProjectLink
          name={row.original.project.name}
          to={`/projects/${encodeURIComponent(row.original.project.id)}/evaluators`}
        />
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
      header: () => (
        <ColumnHeaderWithHelp help="Evaluations waiting, retrying or running now, and how long the oldest has waited.">
          in queue
        </ColumnHeaderWithHelp>
      ),
      size: 110,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      accessorFn: (row) => row.runSummary.queuedCount,
      cell: ({ row }) => (
        <ProjectEvaluatorQueueCell queuedWork={row.original.runSummary} />
      ),
    },
    {
      id: "share",
      header: () => (
        <ColumnHeaderWithHelp help="This evaluator's part of the server queue. Highlighted when the queue is degraded and this evaluator is one of the few holding most of it.">
          share of server queue
        </ColumnHeaderWithHelp>
      ),
      size: 180,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      accessorFn: (row) =>
        getEvaluatorShareOfServerQueue({
          evaluatorQueuedCount: row.runSummary.queuedCount,
          serverQueuedCount,
        }),
      cell: ({ row, getValue }) => (
        <ServerQueueShareCell
          share={getValue() as number}
          isDriver={driverIds.has(row.original.id)}
        />
      ),
    },
    {
      id: "lag",
      header: () => (
        <ColumnHeaderWithHelp help="95% of evaluations that finished in the time range, failures included, did so within this long of being queued. Hover a value for p50 and p99.">
          lag p95
        </ColumnHeaderWithHelp>
      ),
      size: 120,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      sortUndefined: "last",
      accessorFn: (row) => row.lag?.p95Seconds,
      cell: ({ row }) => <ProjectEvaluatorLagCell lag={row.original.lag} />,
    },
    {
      id: "load",
      header: () => (
        <ColumnHeaderWithHelp help="This evaluator's part of the server's evaluation time over the last hour, whatever the time range.">
          eval time share
        </ColumnHeaderWithHelp>
      ),
      size: 150,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      sortUndefined: "last",
      accessorFn: (row) =>
        row.evaluationLoad.shareOfEvaluationTime ?? undefined,
      cell: ({ row }) => (
        <ProjectEvaluatorLoadCell
          evaluationLoad={row.original.evaluationLoad}
          isTracingEnabled={row.original.tracingEnabled}
        />
      ),
    },
    {
      id: "failures",
      header: () => (
        <ColumnHeaderWithHelp help="Share of evaluations that finished in the time range and were given up on, because retries ran out or the error is not retried.">
          failure rate
        </ColumnHeaderWithHelp>
      ),
      size: 130,
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
      header: () => (
        <ColumnHeaderWithHelp help="Token cost of this evaluator's LLM calls in the time range. Evaluators that make no LLM calls have no cost.">
          total cost
        </ColumnHeaderWithHelp>
      ),
      size: 120,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      sortUndefined: "last",
      accessorFn: (row) =>
        row.tracingEnabled
          ? (row.traceProject.costSummary.total.cost ?? undefined)
          : undefined,
      cell: ({ row }) => (
        <ProjectEvaluatorCost
          evaluatorKind={row.original.evaluator.kind}
          costSummary={row.original.traceProject.costSummary}
          isTracingEnabled={row.original.tracingEnabled}
        />
      ),
    },
    {
      id: "averageCost",
      header: () => (
        <ColumnHeaderWithHelp help="Total cost divided by the number of evaluations traced in the time range.">
          avg cost / evaluation
        </ColumnHeaderWithHelp>
      ),
      size: 170,
      meta: { textAlign: "right" },
      sortDescFirst: true,
      sortUndefined: "last",
      accessorFn: (row) => {
        const cost = row.traceProject.costSummary.total.cost;
        const runCount = row.traceProject.traceCount;
        return row.tracingEnabled && cost != null && runCount > 0
          ? cost / runCount
          : undefined;
      },
      cell: ({ row }) => (
        <ProjectEvaluatorAverageCost
          evaluatorKind={row.original.evaluator.kind}
          costSummary={row.original.traceProject.costSummary}
          runCount={row.original.traceProject.traceCount}
          isTracingEnabled={row.original.tracingEnabled}
        />
      ),
    },
  ];
  const table = useTable({
    features: appTableFeatures,
    data: rows as TableRow[],
    columns,
    state: { sorting, rowSelection },
    onSortingChange,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
  });
  const tableRows = table.getRowModel().rows;
  return (
    <>
      <table css={tableCSS} aria-label="Project evaluators across all projects">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableColumnHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        {tableRows.length === 0 ? (
          <TableEmptyWrap>
            <CompactEmptyState
              icon={<Icon svg={<Icons.Scale />} />}
              description="No project evaluators"
              isFiltered={trimmedFilter.length > 0 || picked.size > 0}
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
                      whiteSpace: "nowrap",
                      textAlign: cell.column.columnDef.meta?.textAlign,
                      userSelect:
                        cell.column.id === CHECKBOX_COLUMN_ID
                          ? "none"
                          : undefined,
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
      {selectedEvaluators.length > 0 ? (
        <>
          <EvaluatorSelectionToolbar
            selectedCount={selectedEvaluators.length}
            onClearSelection={() => setRowSelection({})}
            onDelete={() => setIsDeleteDialogOpen(true)}
          />
          <DeleteProjectEvaluatorDialog
            projectEvaluators={selectedEvaluators}
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onDeleted={() => {
              setRowSelection({});
              onEvaluatorsDeleted();
            }}
          />
        </>
      ) : null}
    </>
  );
}
