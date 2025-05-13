import { useCallback, useMemo, useRef, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  HelpTooltip,
  ProgressBar,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Flex, Heading, Link, Text, View } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { SequenceNumberToken } from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { CompactJSONCell, IntCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import {
  floatFormatter,
  formatPercent,
} from "@phoenix/utils/numberFormatUtils";

import { RunExperimentButton } from "../dataset/RunExperimentButton";

import { experimentsLoaderQuery$data } from "./__generated__/experimentsLoaderQuery.graphql";
import type { ExperimentsTableFragment$key } from "./__generated__/ExperimentsTableFragment.graphql";
import { ExperimentsTableQuery } from "./__generated__/ExperimentsTableQuery.graphql";
import { DownloadExperimentActionMenu } from "./DownloadExperimentActionMenu";
import { ErrorRateCell } from "./ErrorRateCell";
import { ExperimentSelectionToolbar } from "./ExperimentSelectionToolbar";

const PAGE_SIZE = 100;

export function ExperimentsTableEmpty() {
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={css`
            text-align: center;
            padding: var(--ac-global-dimension-size-400) !important;
            button {
              margin-top: var(--ac-global-dimension-size-200);
              margin-left: auto;
              margin-right: auto;
            }
          `}
        >
          No experiments for this dataset. To see how to run experiments on a
          dataset, check out the documentation.
          <RunExperimentButton />
        </td>
      </tr>
    </tbody>
  );
}

export function ExperimentsTable({
  dataset,
}: {
  dataset: experimentsLoaderQuery$data["dataset"];
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ExperimentsTableQuery, ExperimentsTableFragment$key>(
      graphql`
        fragment ExperimentsTableFragment on Dataset
        @refetchable(queryName: "ExperimentsTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
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
                annotationSummaries {
                  annotationName
                  meanScore
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
            acc[summary.annotationName] = summary;
            return acc;
          },
          {} as Record<
            string,
            { annotationName: string; meanScore: number | null } | undefined
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
              to={`/datasets/${dataset.id}/compare?experimentId=${experimentId}`}
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
            wrap
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
                refetch({}, { fetchPolicy: "store-and-network" });
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
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedExperiments = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

  const isEmpty = rows.length === 0;

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
  const navigate = useNavigate();
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
        width: table.getTotalSize();
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table css={selectableTableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  align={header.column.columnDef?.meta?.textAlign}
                >
                  <div>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <ExperimentsTableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => {
                  navigate(
                    `/datasets/${dataset.id}/compare?experimentId=${row.original.id}`
                  );
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
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
      {selectedRows.length ? (
        <ExperimentSelectionToolbar
          datasetId={dataset.id}
          selectedExperiments={selectedExperiments}
          onClearSelection={clearSelection}
          onExperimentsDeleted={() => {
            refetch({}, { fetchPolicy: "store-and-network" });
          }}
        />
      ) : null}
    </div>
  );
}

function AnnotationAggregationCell({
  annotationName,
  value,
  min,
  max,
}: {
  annotationName: string;
  value: number;
  min?: number | null;
  max?: number | null;
}) {
  const color = useWordColor(annotationName);
  const percentile = useMemo(() => {
    // Assume a 0 to 1 range if min and max are not provided
    const correctedMin = typeof min === "number" ? min : 0;
    const correctedMax = typeof max === "number" ? max : 1;
    if (correctedMin === correctedMax && correctedMax === value) {
      // All the values are the same, so we want to display it as full rather than empty
      return 100;
    }
    // Avoid division by zero
    const range = correctedMax - correctedMin || 1;
    return ((value - correctedMin) / range) * 100;
  }, [value, min, max]);
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
          {floatFormatter(value)}
          <ProgressBar
            width="40px"
            value={percentile}
            aria-label="where the mean score lands between overall min max"
          />
        </div>
      </TriggerWrap>
      <HelpTooltip>
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
        </View>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
