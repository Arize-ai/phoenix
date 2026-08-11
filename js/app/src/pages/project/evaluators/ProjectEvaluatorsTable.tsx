import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { startTransition, useCallback, useEffect, useMemo } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  LoadMoreButton,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { ProjectEvaluatorsTable_project$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_project.graphql";
import type { ProjectEvaluatorsTable_row$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";
import { ProjectEvaluatorActionMenu } from "@phoenix/pages/project/evaluators/ProjectEvaluatorActionMenu";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorsEmptyState } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsEmptyState";

const PAGE_SIZE = 30;

const scrollableAreaCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

const readRow = (row: ProjectEvaluatorsTable_row$key) => {
  return readInlineData(
    graphql`
      fragment ProjectEvaluatorsTable_row on ProjectEvaluator @inline {
        id
        name
        evaluationTarget
        filterCondition
        samplingRate
        enabled
        evaluator {
          kind
        }
      }
    `,
    row
  );
};

type TableRow = ReturnType<typeof readRow>;

export function ProjectEvaluatorsTable({
  project,
  projectId,
  filter,
}: {
  project: ProjectEvaluatorsTable_project$key;
  projectId: string;
  /** Free-text name search from the toolbar; empty means unfiltered. */
  filter: string;
}) {
  "use no memo";
  const {
    data,
    hasNext,
    isLoadingNext,
    loadNext: _loadNext,
    refetch,
  } = usePaginationFragment(
    graphql`
      fragment ProjectEvaluatorsTable_project on Project
      @refetchable(queryName: "ProjectEvaluatorsTablePaginationQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 30 }
        after: { type: "String", defaultValue: null }
        filter: { type: "ProjectEvaluatorFilter", defaultValue: null }
      ) {
        evaluators(first: $first, after: $after, filter: $filter)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
            }
          }
        }
      }
    `,
    project
  );
  const trimmedFilter = filter.trim();
  // Filtered server-side; a client-side filter would only see the loaded page.
  useEffect(() => {
    startTransition(() => {
      refetch(
        {
          filter: trimmedFilter ? { col: "name", value: trimmedFilter } : null,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [trimmedFilter, refetch]);
  const loadNext = useCallback(() => {
    _loadNext(PAGE_SIZE, {
      UNSTABLE_extraVariables: {
        filter: trimmedFilter ? { col: "name", value: trimmedFilter } : null,
      },
    });
  }, [_loadNext, trimmedFilter]);
  const tableData = useMemo(
    () => data.evaluators.edges.map(({ node }) => readRow(node)),
    [data.evaluators.edges]
  );
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const openEditSlideover = useCallback(
    (projectEvaluatorId: string) => navigate(paths.edit(projectEvaluatorId)),
    [navigate, paths]
  );
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) =>
          formatEvaluationTarget(row.original.evaluationTarget),
      },
      {
        id: "filter",
        header: "Filter",
        cell: ({ row }) => (
          <Text color={row.original.filterCondition ? undefined : "text-700"}>
            {row.original.filterCondition || "All spans"}
          </Text>
        ),
      },
      {
        id: "sampling",
        header: "Sampling",
        cell: ({ row }) => formatSamplingRate(row.original.samplingRate),
      },
      {
        id: "enabled",
        header: "Enabled",
        cell: ({ row }) => (
          <ProjectEvaluatorEnabledSwitch
            projectEvaluatorId={row.original.id}
            name={row.original.name}
            enabled={row.original.enabled}
          />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <ProjectEvaluatorActionMenu
            projectEvaluatorId={row.original.id}
            projectId={projectId}
            evaluatorKind={row.original.evaluator.kind}
            evaluatorName={row.original.name}
            onEdit={openEditSlideover}
          />
        ),
      },
    ],
    [projectId, openEditSlideover]
  );
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const isFiltered = trimmedFilter.length > 0;
  if (isEmpty && !isFiltered) {
    return (
      <div css={scrollableAreaCSS}>
        <ProjectEvaluatorsEmptyState />
      </div>
    );
  }
  return (
    <div css={scrollableAreaCSS}>
      <table css={tableCSS} aria-label="Project evaluators">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmptyWrap>
            <CompactEmptyState
              icon={<Icon svg={<Icons.Scale />} />}
              description="No evaluators"
              isFiltered={isFiltered}
            />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {hasNext ? (
        <View padding="size-100">
          <Flex justifyContent="center">
            <LoadMoreButton
              isLoadingNext={isLoadingNext}
              onLoadMore={loadNext}
            />
          </Flex>
        </View>
      ) : null}
    </div>
  );
}

function formatEvaluationTarget(target: "SPAN" | "TRACE" | "SESSION") {
  return `${target.charAt(0)}${target.slice(1).toLowerCase()}`;
}

function formatSamplingRate(samplingRate: number) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(samplingRate);
}
