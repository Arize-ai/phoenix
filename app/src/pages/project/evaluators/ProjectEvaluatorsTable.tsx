import { css } from "@emotion/react";
import type { ColumnDef, ColumnSizingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo, useRef, useState } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";

import { Empty, Flex, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { PercentCell, TableEmptyWrap } from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { PromptCell } from "@phoenix/pages/evaluators/PromptCell";
import type { ProjectEvaluatorsTable_evaluators$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_evaluators.graphql";
import type {
  EvaluationTarget,
  ProjectEvaluatorsTable_row$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";
import { MOCK_PROJECT_EVALUATOR_ROWS } from "@phoenix/pages/project/evaluators/projectEvaluatorsMockData";
import { classNames } from "@phoenix/utils/classNames";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

const PAGE_SIZE = 100;

function readProjectEvaluatorRow(row: ProjectEvaluatorsTable_row$key) {
  return readInlineData(
    graphql`
      fragment ProjectEvaluatorsTable_row on ProjectEvaluator @inline {
        id
        name
        evaluationTarget
        samplingRate
        filterCondition
        updatedAt
        evaluator {
          id
          kind
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersionTag {
              name
            }
            promptVersion {
              modelName
              modelProvider
            }
          }
        }
      }
    `,
    row
  );
}

type ProjectEvaluatorTableRow = ReturnType<typeof readProjectEvaluatorRow>;

function getEvaluationTargetLabel(target: EvaluationTarget): string {
  switch (target) {
    case "SPAN":
      return "Span";
    case "TRACE":
      return "Trace";
    case "SESSION":
      return "Session";
  }
}

const PROJECT_EVALUATOR_COLUMNS: ColumnDef<ProjectEvaluatorTableRow>[] = [
  {
    header: "name",
    accessorKey: "name",
    size: 220,
  },
  {
    header: "kind",
    accessorFn: (row) => row.evaluator.kind,
    id: "kind",
    size: 90,
    cell: ({ row }) => (
      <EvaluatorKindToken kind={row.original.evaluator.kind} />
    ),
  },
  {
    header: "target",
    accessorKey: "evaluationTarget",
    size: 110,
    cell: ({ row }) => (
      <Token size="S">
        {getEvaluationTargetLabel(row.original.evaluationTarget)}
      </Token>
    ),
  },
  {
    header: "prompt",
    id: "prompt",
    size: 200,
    cell: ({ row }) => (
      <PromptCell
        prompt={row.original.evaluator.prompt}
        promptVersionTag={row.original.evaluator.promptVersionTag?.name}
        wrapWidth={200}
      />
    ),
  },
  {
    header: "model",
    id: "model",
    size: 200,
    cell: ({ row }) => {
      const promptVersion = row.original.evaluator.promptVersion;
      if (!promptVersion) {
        return <Text color="text-700">—</Text>;
      }
      const { modelName, modelProvider } = promptVersion;
      const isProviderValid = isModelProvider(modelProvider);
      return (
        <Flex direction="row" gap="size-100" alignItems="center">
          {isProviderValid ? (
            <GenerativeProviderIcon provider={modelProvider} height={16} />
          ) : null}
          <Text minWidth={0}>
            <Truncate title={modelName}>{modelName}</Truncate>
          </Text>
        </Flex>
      );
    },
  },
  {
    header: "sampling rate",
    accessorFn: (row) => row.samplingRate * 100,
    id: "samplingRate",
    size: 130,
    cell: PercentCell,
  },
  {
    header: "filter condition",
    accessorKey: "filterCondition",
    size: 260,
    cell: ({ row }) => {
      const filterCondition = row.original.filterCondition;
      if (!filterCondition) {
        return <Text color="text-700">—</Text>;
      }
      return (
        <Truncate title={filterCondition} maxWidth="100%">
          {filterCondition}
        </Truncate>
      );
    },
  },
  {
    header: "updated at",
    accessorKey: "updatedAt",
    size: 180,
    cell: TimestampCell,
  },
];

export function useProjectEvaluatorsTable(
  project: ProjectEvaluatorsTable_evaluators$key
) {
  const {
    data: _,
    hasNext,
    isLoadingNext,
    loadNext,
  } = usePaginationFragment(
    graphql`
      fragment ProjectEvaluatorsTable_evaluators on Project
      @refetchable(queryName: "ProjectEvaluatorsTableEvaluatorsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        evaluators(first: $first, after: $after)
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

  const projectEvaluators = useMemo(() => {
    return MOCK_PROJECT_EVALUATOR_ROWS;

    // return data.evaluators.edges.map((edge) =>
    //   readProjectEvaluatorRow(edge.node)
    // );
  }, []);

  return {
    projectEvaluators,
    hasNext,
    isLoadingNext,
    loadNext: () => loadNext(PAGE_SIZE),
  };
}

type ProjectEvaluatorsTableProps = ReturnType<typeof useProjectEvaluatorsTable>;

export function ProjectEvaluatorsTable({
  projectEvaluators,
  hasNext,
  isLoadingNext,
  loadNext,
}: ProjectEvaluatorsTableProps) {
  "use no memo";
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: PROJECT_EVALUATOR_COLUMNS,
    data: projectEvaluators,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnSizing,
    },
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    getRowId: (row) => row.id,
  });

  const { columnSizingInfo } = table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  /**
   * Calculate all column sizes at once at the root table level and pass them
   * down as CSS variables to avoid calling column.getSize() in every cell.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = getFlatHeaders();
    const columnSizes: Record<string, number> = {};
    for (let index = 0; index < headers.length; index++) {
      const header = headers[index];
      if (!header) {
        continue;
      }
      columnSizes[`--header-${header.id}-size`] = header.getSize();
      columnSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return columnSizes;
    // Disabled as recommended by the TanStack column-sizing example.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizing]);

  const fetchMoreOnBottomReached = (
    containerRefElement?: HTMLDivElement | null
  ) => {
    if (!containerRefElement) {
      return;
    }
    const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
    if (isNearBottom && !isLoadingNext && hasNext) {
      loadNext();
    }
  };

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(event) =>
        fetchMoreOnBottomReached(event.target as HTMLDivElement)
      }
      ref={tableContainerRef}
    >
      <table
        css={selectableTableCSS}
        style={{
          ...columnSizeVars,
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={{
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <>
                      <div
                        style={{
                          textAlign: header.column.columnDef.meta?.textAlign,
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={classNames("resizer", {
                          isResizing: header.column.getIsResizing(),
                        })}
                      />
                    </>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmptyWrap>
            <Empty message="No evaluators are set up for this project" />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const columnSizeVariable = `--col-${cell.column.id}-size`;
                  return (
                    <td
                      key={cell.id}
                      style={{
                        width: `calc(var(${columnSizeVariable}) * 1px)`,
                        maxWidth: `calc(var(${columnSizeVariable}) * 1px)`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
