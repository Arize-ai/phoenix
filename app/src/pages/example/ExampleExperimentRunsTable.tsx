import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";

import { Button, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";

import type { ExampleExperimentRunsTableFragment$key } from "./__generated__/ExampleExperimentRunsTableFragment.graphql";
import type { ExampleExperimentRunsTableQuery } from "./__generated__/ExampleExperimentRunsTableQuery.graphql";

const PAGE_SIZE = 100;

const experimentRunsTableCSS = css`
  table-layout: fixed;

  th,
  td {
    overflow: hidden;
  }
`;

const EXPERIMENT_RUN_COLUMN_WIDTHS = ["20%", "28%", "12%", "30%", "10%"];

export function ExampleExperimentsTableEmpty() {
  return (
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="experiment" />}
        description="No experiments have been run for this example"
      />
    </TableEmptyWrap>
  );
}

const annotationTooltipExtraCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  color: var(--global-color-primary);
  gap: var(--global-dimension-size-50);
`;

export function ExampleExperimentRunsTable({
  example,
}: {
  example: ExampleExperimentRunsTableFragment$key;
}) {
  "use no memo";
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ExampleExperimentRunsTableQuery,
    ExampleExperimentRunsTableFragment$key
  >(
    graphql`
      fragment ExampleExperimentRunsTableFragment on DatasetExample
      @refetchable(queryName: "ExampleExperimentRunsTableQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        experimentRuns(first: $first, after: $after)
          @connection(key: "ExampleExperimentRunsTable_experimentRuns") {
          edges {
            run: node {
              id
              startTime
              endTime
              error
              output
              trace {
                id
                traceId
                projectId
              }
              annotations {
                edges {
                  annotation: node {
                    id
                    name
                    label
                    score
                    explanation
                    metadata
                    annotatorKind
                    trace {
                      id
                      traceId
                      projectId
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    example
  );

  const tableData = useMemo(
    () =>
      data.experimentRuns.edges.map((edge) => {
        let latencyMs: number | null = null;
        if (edge.run.startTime && edge.run.endTime) {
          latencyMs =
            new Date(edge.run.endTime).getTime() -
            new Date(edge.run.startTime).getTime();
        }
        return {
          ...edge.run,
          output: JSON.stringify(edge.run.output),
          latencyMs,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "start time",
      accessorKey: "startTime",
      cell: TimestampCell,
    },
    {
      header: "output",
      accessorKey: "output",
      cell: (props) => {
        // eslint-disable-next-line react/prop-types
        const maybeError = props.row.original?.error;
        if (maybeError !== null) {
          return (
            <Truncate maxWidth="100%" title={maybeError}>
              <Text color="danger">{maybeError}</Text>
            </Truncate>
          );
        }
        return <TextCell {...props} />;
      },
    },
    {
      header: "latency",
      accessorKey: "latencyMs",
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return "--";
        }
        return <LatencyText latencyMs={value} />;
      },
    },
    {
      header: "evaluations",
      accessorKey: "annotations",
      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            {row.original.annotations.edges.map((annotationEdge, index) => {
              const annotation = annotationEdge.annotation;
              return (
                <AnnotationTooltip
                  key={index}
                  annotation={annotation}
                  extra={
                    annotation.trace && (
                      <View paddingTop="size-100">
                        <div css={annotationTooltipExtraCSS}>
                          <Icon svg={<Icons.Info />} />
                          <span>Click to view evaluator trace</span>
                        </div>
                      </View>
                    )
                  }
                >
                  <AnnotationLabel
                    key={index}
                    annotation={annotation}
                    onClick={() => {
                      if (annotation.trace) {
                        navigate(
                          `/projects/${annotation.trace.projectId}/traces/${encodeURIComponent(annotation.trace.traceId)}`
                        );
                      }
                    }}
                  />
                </AnnotationTooltip>
              );
            })}
          </Flex>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const trace = row.original.trace;
        if (trace) {
          return (
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.Trace />} />}
              onPress={() => {
                navigate(
                  `/projects/${trace.projectId}/traces/${encodeURIComponent(trace.traceId)}`
                );
              }}
              aria-label="view trace"
            />
          );
        }
      },
    },
  ];
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
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
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table css={[tableCSS, experimentRunsTableCSS]}>
        <colgroup>
          {EXPERIMENT_RUN_COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
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
          <ExampleExperimentsTableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
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
    </div>
  );
}
