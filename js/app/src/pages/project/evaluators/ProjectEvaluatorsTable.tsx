import { css } from "@emotion/react";
import type { ColumnDef, ColumnSizingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  Link,
  LoadMoreButton,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { EvaluatorCost } from "@phoenix/components/evaluators/EvaluatorCost";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { SandboxConfigLabel } from "@phoenix/components/sandbox/SandboxConfigLabel";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { PromptCell } from "@phoenix/pages/evaluators/PromptCell";
import type { ProjectEvaluatorsTable_project$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_project.graphql";
import type { ProjectEvaluatorsTable_row$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";
import { ProjectEvaluatorActionMenu } from "@phoenix/pages/project/evaluators/ProjectEvaluatorActionMenu";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorsEmptyState } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsEmptyState";
import { ProjectEvaluatorStatusCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStatusCell";
import {
  formatEvaluationTarget,
  formatEvaluationTargetPlural,
  formatSamplingRate,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

const PAGE_SIZE = 30;

const scrollableAreaCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

const readRow = (row: ProjectEvaluatorsTable_row$key) => {
  return readInlineData(
    graphql`
      fragment ProjectEvaluatorsTable_row on ProjectEvaluator
      @inline
      @argumentDefinitions(costTimeRange: { type: "TimeRange" }) {
        id
        name
        evaluationTarget
        filterCondition
        samplingRate
        schedulabilityStatus
        enabled
        updatedAt
        schedulabilityStatus
        schedulabilityReason
        runSummary {
          status
          lastRunAt
          queuedCount
          evaluatedCount
          failedCount
        }
        traceProject {
          id
          costSummary(timeRange: $costTimeRange) {
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
        evaluator {
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
          ... on CodeEvaluator {
            language
            sandboxConfig {
              id
              name
              provider {
                backendType
              }
            }
          }
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
        costTimeRange: { type: "TimeRange" }
      ) {
        evaluators(first: $first, after: $after, filter: $filter)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
                @arguments(costTimeRange: $costTimeRange)
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
        header: "name",
        size: 200,
        accessorKey: "name",
        cell: ({ getValue, row }) => (
          <Link to={paths.details(row.original.id)}>
            <Truncate maxWidth="100%">{getValue() as string}</Truncate>
          </Link>
        ),
      },
      {
        id: "status",
        header: "status",
        size: 130,
        cell: ({ row }) => (
          <ProjectEvaluatorStatusCell
            schedulabilityStatus={row.original.schedulabilityStatus}
            schedulabilityReason={row.original.schedulabilityReason}
            runSummary={row.original.runSummary}
          />
        ),
      },
      {
        id: "kind",
        header: "kind",
        size: 80,
        cell: ({ row }) => (
          <EvaluatorKindToken kind={row.original.evaluator.kind} />
        ),
      },
      {
        id: "prompt",
        header: "prompt",
        size: 180,
        cell: ({ row }) => {
          const { prompt, promptVersionTag } = row.original.evaluator;
          if (!prompt) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <PromptCell
              prompt={prompt}
              promptVersionTag={promptVersionTag?.name}
            />
          );
        },
      },
      {
        id: "model",
        header: "model",
        size: 180,
        cell: ({ row }) => {
          const promptVersion = row.original.evaluator.promptVersion;
          if (!promptVersion) {
            return <Text color="text-700">—</Text>;
          }
          const { modelName, modelProvider } = promptVersion;
          const providerIsValid = isModelProvider(modelProvider);
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              {providerIsValid && (
                <GenerativeProviderIcon provider={modelProvider} height={16} />
              )}
              <Text minWidth={0}>
                <Truncate>{modelName}</Truncate>
              </Text>
            </Flex>
          );
        },
      },
      {
        id: "cost",
        header: "cost (7d)",
        size: 100,
        meta: { textAlign: "right" },
        cell: ({ row }) => (
          <EvaluatorCost
            evaluatorKind={row.original.evaluator.kind}
            costSummary={row.original.traceProject.costSummary}
          />
        ),
      },
      {
        id: "language",
        header: "language",
        size: 110,
        cell: ({ row }) => {
          const language = row.original.evaluator.language;
          if (!language) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              {language === "PYTHON" ? <PythonSVG /> : <TypeScriptSVG />}
              <Text>{language === "PYTHON" ? "Python" : "TypeScript"}</Text>
            </Flex>
          );
        },
      },
      {
        id: "sandbox",
        header: "sandbox",
        size: 160,
        cell: ({ row }) => {
          const sandboxConfig = row.original.evaluator.sandboxConfig;
          if (!sandboxConfig) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <SandboxConfigLabel
              sandboxConfigId={sandboxConfig.id}
              name={sandboxConfig.name}
              backendType={sandboxConfig.provider.backendType}
            />
          );
        },
      },
      {
        id: "target",
        header: "target",
        size: 110,
        // A disabled evaluator already reads as not running from its own
        // column, so only flag scope-driven reasons here.
        cell: ({ row }) => (
          <Flex direction="row" gap="size-100" alignItems="center">
            <Text>{formatEvaluationTarget(row.original.evaluationTarget)}</Text>
            {row.original.enabled &&
            row.original.schedulabilityStatus === "NOT_SCHEDULABLE" ? (
              <span title="This evaluator is not scheduled.">
                <Icon svg={<Icons.AlertTriangle />} color="warning" />
              </span>
            ) : null}
          </Flex>
        ),
      },
      {
        id: "filter",
        header: "filter",
        size: 180,
        cell: ({ row }) => (
          <Text color={row.original.filterCondition ? undefined : "text-700"}>
            {row.original.filterCondition ||
              `All ${formatEvaluationTargetPlural(row.original.evaluationTarget)}`}
          </Text>
        ),
      },
      {
        id: "sampling",
        header: "sampling",
        size: 100,
        cell: ({ row }) => formatSamplingRate(row.original.samplingRate),
      },
      {
        id: "updatedAt",
        header: "last updated",
        size: 160,
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
      {
        id: "enabled",
        header: "enabled",
        size: 90,
        cell: ({ row }) => (
          <StopPropagation>
            <ProjectEvaluatorEnabledSwitch
              projectEvaluatorId={row.original.id}
              name={row.original.name}
              enabled={row.original.enabled}
            />
          </StopPropagation>
        ),
      },
      {
        id: "actions",
        header: "actions",
        size: 80,
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
    [projectId, openEditSlideover, paths]
  );
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      columnPinning: {
        right: ["enabled", "actions"],
      },
      columnSizing,
    },
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const { columnSizingInfo } = table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  /**
   * Calculate all column sizes at once at the root table level
   * and pass them down as CSS variables to the <table> element.
   * This avoids calling `column.getSize()` on every render for every cell.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // Disabled lint as per tanstack docs linked above

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizing]);
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
      <table
        css={selectableTableCSS}
        aria-label="Project evaluators"
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
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                    ...(header.column.getIsPinned()
                      ? {
                          ...getCommonPinningStyles(header.column),
                          zIndex: 3,
                        }
                      : {}),
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
                        {...{
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
                          className: `resizer ${
                            header.column.getIsResizing() ? "isResizing" : ""
                          }`,
                        }}
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
            <CompactEmptyState
              icon={<Icon svg={<Icons.Scale />} />}
              description="No evaluators"
              isFiltered={isFiltered}
            />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => navigate(paths.details(row.original.id))}
              >
                {row.getVisibleCells().map((cell) => {
                  const colSizeVar = `--col-${cell.column.id}-size`;
                  return (
                    <td
                      key={cell.id}
                      style={{
                        width: `calc(var(${colSizeVar}) * 1px)`,
                        maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: cell.column.columnDef.meta?.textAlign,
                        ...(cell.column.getIsPinned()
                          ? getCommonPinningStyles(cell.column)
                          : {}),
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
