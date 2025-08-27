import { memo, useCallback, useMemo, useRef, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Link,
  ProgressBar,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import {
  ExperimentTokenCount,
  SequenceNumberToken,
} from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { ExperimentTokenCosts } from "@phoenix/components/experiment/ExperimentTokenCosts";
import {
  CompactJSONCell,
  IntCell,
  LoadMoreRow,
} from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import {
  floatFormatter,
  formatPercent,
} from "@phoenix/utils/numberFormatUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type {
  ExperimentsTableFragment$data,
  ExperimentsTableFragment$key,
} from "./__generated__/ExperimentsTableFragment.graphql";
import { ExperimentsTableQuery } from "./__generated__/ExperimentsTableQuery.graphql";
import { DownloadExperimentActionMenu } from "./DownloadExperimentActionMenu";
import { ErrorRateCell } from "./ErrorRateCell";
import { ExperimentSelectionToolbar } from "./ExperimentSelectionToolbar";

const PAGE_SIZE = 100;

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

const TableBody = <T extends { id: string }>({
  table,
  hasNext,
  onLoadNext,
  isLoadingNext,
  dataset,
}: {
  table: Table<T>;
  hasNext: boolean;
  onLoadNext: () => void;
  isLoadingNext: boolean;
  dataset: ExperimentsTableFragment$data;
}) => {
  const navigate = useNavigate();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        return (
          <tr
            key={row.id}
            onClick={() => {
              navigate(
                `/datasets/${dataset.id}/compare?experimentId=${row.original.id}`
              );
            }}
          >
            {row.getVisibleCells().map((cell) => {
              const colSizeVar = `--col-${makeSafeColumnId(cell.column.id)}-size`;
              return (
                <td
                  key={cell.id}
                  style={{
                    width: `calc(var(${colSizeVar}) * 1px)`,
                    maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
      {hasNext ? (
        <LoadMoreRow
          onLoadMore={onLoadNext}
          key="load-more"
          isLoadingNext={isLoadingNext}
        />
      ) : null}
    </tbody>
  );
};

// Memoized wrapper for table body to use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function ExperimentsTable({
  dataset,
}: {
  dataset: ExperimentsTableFragment$key;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [columnSizing, setColumnSizing] = useState({});
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ExperimentsTableQuery, ExperimentsTableFragment$key>(
      graphql`
        fragment ExperimentsTableFragment on Dataset
        @refetchable(queryName: "ExperimentsTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
          id
          experimentAnnotationSummaries {
            annotationName
            minScore
            maxScore
          }
          experiments(first: $first, after: $after)
            @connection(key: "ExperimentsTable_experiments") {
            edges {
              experiment: node {
                id
                name
                sequenceNumber
                description
                createdAt
                metadata
                errorRate
                runCount
                averageRunLatencyMs
                project {
                  id
                }
                costSummary {
                  total {
                    tokens
                    cost
                  }
                  prompt {
                    tokens
                    cost
                  }
                  completion {
                    tokens
                    cost
                  }
                }
                annotationSummaries {
                  annotationName
                  meanScore
                  count
                  errorCount
                }
              }
            }
          }
        }
      `,
      dataset
    );

  const tableData = useMemo(
    () =>
      data.experiments.edges.map((edge) => {
        const annotationSummaryMap = edge.experiment.annotationSummaries.reduce(
          (acc, summary) => {
            const coverage =
              edge.experiment.runCount > 0
                ? (summary.count - summary.errorCount) /
                  edge.experiment.runCount
                : null;
            acc[summary.annotationName] = {
              ...summary,
              coverage,
            };
            return acc;
          },
          {} as Record<
            string,
            | {
                annotationName: string;
                meanScore: number | null;
                coverage: number | null;
              }
            | undefined
          >
        );
        return {
          ...edge.experiment,
          annotationSummaryMap,
        };
      }),
    [data.experiments.edges]
  );

  type TableRow = (typeof tableData)[number];

  const baseColumns: ColumnDef<TableRow>[] = [
    {
      id: "select",
      maxSize: 50,
      header: ({ table }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler(),
          }}
        />
      ),
      cell: ({ row }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      ),
    },
    {
      header: "name",
      accessorKey: "name",
      minSize: 200,
      cell: ({ getValue, row }) => {
        const experimentId = row.original.id;
        const sequenceNumber = row.original.sequenceNumber;
        return (
          <Flex direction="row" gap="size-100" alignItems="center">
            <SequenceNumberToken sequenceNumber={sequenceNumber} />
            <Link
              to={`/datasets/${data.id}/compare?experimentId=${experimentId}`}
            >
              {getValue() as string}
            </Link>
          </Flex>
        );
      },
    },
    {
      header: "description",
      accessorKey: "description",
      minSize: 300,
      cell: TextCell,
    },
    {
      header: "created at",
      accessorKey: "createdAt",
      cell: TimestampCell,
    },
  ];

  const annotationColumns: ColumnDef<TableRow>[] =
    data.experimentAnnotationSummaries.map((annotationSummary) => {
      const { annotationName, minScore, maxScore } = annotationSummary;
      return {
        header: () => (
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            justifyContent="end"
          >
            <Text>{annotationName}</Text>
            <AnnotationColorSwatch annotationName={annotationName} />
          </Flex>
        ),
        id: `annotation-${annotationName}`,
        meta: {
          textAlign: "right",
        },
        cell: ({ row }) => {
          const annotation = row.original.annotationSummaryMap[annotationName];
          if (!annotation || annotation.meanScore == null) {
            return (
              <span
                css={css`
                  float: right;
                `}
              >
                --
              </span>
            );
          }
          return (
            <AnnotationAggregationCell
              annotationName={annotationName}
              value={annotation.meanScore}
              min={minScore}
              max={maxScore}
              coverage={annotation.coverage}
            />
          );
        },
      };
    });

  const tailColumns: ColumnDef<TableRow>[] = [
    {
      header: "run count",
      accessorKey: "runCount",
      meta: {
        textAlign: "right",
      },
      cell: IntCell,
    },
    {
      header: "avg latency",
      accessorKey: "averageRunLatencyMs",
      meta: {
        textAlign: "right",
      },
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return "--";
        }
        return <LatencyText latencyMs={value} />;
      },
    },
    {
      header: "total cost",
      accessorKey: "costSummary.total.cost",
      meta: {
        textAlign: "right",
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        const experimentId = row.original.id;
        if (value == null) {
          return "--";
        }
        return (
          <ExperimentTokenCosts totalCost={value} experimentId={experimentId} />
        );
      },
    },
    {
      header: "total tokens",
      accessorKey: "costSummary.total.tokens",
      meta: {
        textAlign: "right",
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        const experimentId = row.original.id;
        return (
          <ExperimentTokenCount
            tokenCountTotal={value}
            experimentId={experimentId}
            size="S"
          />
        );
      },
    },
    {
      header: "error rate",
      accessorKey: "errorRate",
      meta: {
        textAlign: "right",
      },
      cell: ErrorRateCell,
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      minSize: 200,
      cell: CompactJSONCell,
    },
    {
      id: "actions",
      maxSize: 120,
      cell: ({ row }) => {
        const project = row.original.project;
        const metadata = row.original.metadata;
        return (
          <Flex direction="row" gap="size-100">
            <DownloadExperimentActionMenu experimentId={row.original.id} />
            <ExperimentActionMenu
              projectId={project?.id || null}
              experimentId={row.original.id}
              metadata={metadata}
              canDeleteExperiment={true}
              onExperimentDeleted={() => {
                refetch({}, { fetchPolicy: "network-only" });
              }}
            />
          </Flex>
        );
      },
    },
  ];

  const table = useReactTable<TableRow>({
    columns: [...baseColumns, ...annotationColumns, ...tailColumns],
    data: tableData,
    state: {
      rowSelection,
      columnSizing,
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedExperiments = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
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

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;

  /**
   * Calculate all column sizes at once as CSS variables for performance
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const [columnSizeVars] = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return [colSizes];
    // Disabled lint as per tanstack docs linked above
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState]);

  return (
    <div
      css={css`
        height: 100%;
        overflow: auto;
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
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
                    width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                  }}
                  align={header.column.columnDef?.meta?.textAlign}
                >
                  {header.isPlaceholder ? null : (
                    <>
                      <div>
                        <Truncate maxWidth="100%">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </Truncate>
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
        {columnSizingInfo.isResizingColumn ? (
          <MemoizedTableBody
            table={table}
            hasNext={hasNext}
            onLoadNext={() => loadNext(PAGE_SIZE)}
            isLoadingNext={isLoadingNext}
            dataset={data}
          />
        ) : (
          <TableBody
            table={table}
            hasNext={hasNext}
            onLoadNext={() => loadNext(PAGE_SIZE)}
            isLoadingNext={isLoadingNext}
            dataset={data}
          />
        )}
      </table>
      {selectedRows.length ? (
        <ExperimentSelectionToolbar
          datasetId={data.id}
          selectedExperiments={selectedExperiments}
          onClearSelection={clearSelection}
          onExperimentsDeleted={() => {
            refetch({}, { fetchPolicy: "network-only" });
          }}
        />
      ) : null}
    </div>
  );
}

function CoveragePieChart({ coverage }: { coverage: number }) {
  const size = 16;
  const strokeWidth = 2;
  const center = size / 2;
  const radius = center - strokeWidth / 2;

  const nonCoverage = 1 - coverage;

  // Calculate the arc path for the non-coverage percentage (counter-clockwise)
  const nonCoverageAngle = nonCoverage * 2 * Math.PI;
  const x1 = center + radius * Math.cos(-Math.PI / 2);
  const y1 = center + radius * Math.sin(-Math.PI / 2);
  const x2 = center + radius * Math.cos(-Math.PI / 2 - nonCoverageAngle);
  const y2 = center + radius * Math.sin(-Math.PI / 2 - nonCoverageAngle);

  const largeArc = nonCoverageAngle > Math.PI ? 1 : 0;

  return (
    <svg
      width={size}
      height={size}
      css={css`
        flex-shrink: 0;
      `}
    >
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="var(--ac-global-color-grey-300)"
        opacity={0.5}
      />
      {/* Non-coverage arc (missing data - warning color) */}
      {nonCoverage > 0 && (
        <path
          d={`M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 ${largeArc},0 ${x2},${y2} Z`}
          fill="var(--ac-global-color-warning)"
          opacity={0.8}
        />
      )}
    </svg>
  );
}

function AnnotationAggregationCell({
  annotationName,
  value,
  min,
  max,
  coverage,
}: {
  annotationName: string;
  value: number;
  min?: number | null;
  max?: number | null;
  coverage: number | null;
}) {
  const color = useWordColor(annotationName);
  const percentile = useMemo(
    () => calculateAnnotationScorePercentile(value, min, max),
    [value, min, max]
  );
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <div
          css={css`
            float: right;
            --mod-barloader-fill-color: ${color};
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ac-global-dimension-size-100);
          `}
        >
          {coverage !== null && coverage < 1.0 && (
            <CoveragePieChart coverage={coverage} />
          )}
          {floatFormatter(value)}
          <ProgressBar
            width="40px"
            value={percentile}
            aria-label="where the mean score lands between overall min max"
          />
        </div>
      </TriggerWrap>
      <RichTooltip>
        <View width="size-2400">
          <Heading level={3} weight="heavy">
            {annotationName}
          </Heading>
          <Flex direction="column">
            <Flex justifyContent="space-between">
              <Text weight="heavy" size="XS">
                Mean Score
              </Text>
              <Text size="XS">{floatFormatter(value)}</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text weight="heavy" size="XS">
                All Experiments Min
              </Text>
              <Text size="XS">{floatFormatter(min)}</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text weight="heavy" size="XS">
                All Experiments Max
              </Text>
              <Text size="XS">{floatFormatter(max)}</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text weight="heavy" size="XS">
                Mean Score Percentile
              </Text>
              <Text size="XS">{formatPercent(percentile)}</Text>
            </Flex>
          </Flex>
          {coverage !== null && coverage < 1.0 && (
            <Flex direction="column" marginTop="size-100">
              <View
                borderTopWidth="thin"
                borderTopColor="default"
                paddingTop="size-100"
              >
                <Flex justifyContent="space-between">
                  <Text weight="heavy" size="XS" color="warning">
                    Missing Data
                  </Text>
                  <Text size="XS" color="warning">
                    {formatPercent((1 - coverage) * 100)}
                  </Text>
                </Flex>
              </View>
            </Flex>
          )}
        </View>
      </RichTooltip>
    </TooltipTrigger>
  );
}
