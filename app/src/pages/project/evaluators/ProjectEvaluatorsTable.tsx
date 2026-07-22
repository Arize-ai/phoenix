import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";

import { Flex, LoadMoreButton, Text, View } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ProjectEvaluatorsTable_project$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_project.graphql";
import type { ProjectEvaluatorsTable_row$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { ProjectEvaluatorActionMenu } from "@phoenix/pages/project/evaluators/ProjectEvaluatorActionMenu";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorsEmptyGallery } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsEmptyGallery";

const PAGE_SIZE = 30;

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
}: {
  project: ProjectEvaluatorsTable_project$key;
  projectId: string;
}) {
  "use no memo";
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment ProjectEvaluatorsTable_project on Project
      @refetchable(queryName: "ProjectEvaluatorsTablePaginationQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 30 }
        after: { type: "String", defaultValue: null }
      ) {
        evaluators(first: $first, after: $after)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          __id
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
  const connectionId = data.evaluators.__id;
  const connectionIds = useMemo(() => [connectionId], [connectionId]);
  const tableData = useMemo(
    () => data.evaluators.edges.map(({ node }) => readRow(node)),
    [data.evaluators.edges]
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
            evaluatorKind={row.original.evaluator.kind}
            evaluatorName={row.original.name}
            updateConnectionIds={connectionIds}
          />
        ),
      },
    ],
    [connectionIds]
  );
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  return (
    <>
      <View padding="size-100" flex="none">
        <Flex direction="row" justifyContent="end">
          <AddProjectEvaluatorMenu
            size="M"
            projectId={projectId}
            updateConnectionIds={connectionIds}
          />
        </Flex>
      </View>
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
        `}
      >
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
          {rows.length === 0 ? (
            <ProjectEvaluatorsEmptyGallery
              projectId={projectId}
              updateConnectionIds={connectionIds}
            />
          ) : (
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
                onLoadMore={() => loadNext(PAGE_SIZE)}
              />
            </Flex>
          </View>
        ) : null}
      </div>
    </>
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
