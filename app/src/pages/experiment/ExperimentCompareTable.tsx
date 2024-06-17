import React, { ReactNode, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";
import {
  CellContext,
  Column,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { ActionMenu, Flex, Icon, Icons, Item, Text } from "@arizeai/components";

import { JSONText } from "@phoenix/components/code/JSONText";
import { AnnotationLabel } from "@phoenix/components/experiment";
import { SequenceNumberLabel } from "@phoenix/components/experiment/SequenceNumberLabel";
import { CompactJSONCell } from "@phoenix/components/table";
import {
  borderedTableCSS,
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ExperimentCompareTableQuery,
  ExperimentCompareTableQuery$data,
} from "./__generated__/ExperimentCompareTableQuery.graphql";

type ExampleCompareTableProps = {
  datasetId: string;
  experimentIds: string[];
  /**
   * Whether to display the full text of the text fields
   */
  displayFullText: boolean;
};

type ExperimentRun =
  ExperimentCompareTableQuery$data["comparisons"][number]["runComparisonItems"][number]["runs"][number];

export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  const { datasetId, experimentIds, displayFullText } = props;
  const data = useLazyLoadQuery<ExperimentCompareTableQuery>(
    graphql`
      query ExperimentCompareTableQuery(
        $experimentIds: [GlobalID!]!
        $datasetId: GlobalID!
      ) {
        comparisons: compareExperiments(experimentIds: $experimentIds) {
          example {
            id
            revision {
              input
              referenceOutput: output
            }
          }
          runComparisonItems {
            experimentId
            runs {
              output
              error
              startTime
              endTime
              annotations {
                edges {
                  annotation: node {
                    id
                    name
                    score
                    label
                    explanation
                  }
                }
              }
            }
          }
        }
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            experiments {
              edges {
                experiment: node {
                  id
                  name
                  sequenceNumber
                }
              }
            }
          }
        }
      }
    `,
    {
      experimentIds,
      datasetId,
    }
  );
  const experimentInfoById = useMemo(() => {
    return (
      data.dataset?.experiments?.edges.reduce(
        (acc, edge) => {
          acc[edge.experiment.id] = { ...edge.experiment };
          return acc;
        },
        {} as Record<
          string,
          { name: string; sequenceNumber: number } | undefined
        >
      ) || {}
    );
  }, [data]);
  const tableData = useMemo(
    () =>
      data.comparisons.map((comparison) => {
        const runComparisonMap = comparison.runComparisonItems.reduce(
          (acc, item) => {
            acc[item.experimentId] = item;
            return acc;
          },
          {} as Record<
            string,
            ExperimentCompareTableQuery$data["comparisons"][number]["runComparisonItems"][number]
          >
        );
        return {
          ...comparison,
          id: comparison.example.id,
          input: comparison.example.revision.input,
          referenceOutput: comparison.example.revision.referenceOutput,
          runComparisonMap,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const baseColumns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: displayFullText ? JSONCell : CompactJSONCell,
    },
    {
      header: "reference output",
      accessorKey: "referenceOutput",
      cell: displayFullText ? JSONCell : CompactJSONCell,
    },
  ];

  const experimentColumns: ColumnDef<TableRow>[] = experimentIds.map(
    (experimentId) => ({
      header: () => {
        const name = experimentInfoById[experimentId]?.name;
        const sequenceNumber =
          experimentInfoById[experimentId]?.sequenceNumber || 0;
        return (
          <Flex direction="row" gap="size-100" wrap>
            <SequenceNumberLabel sequenceNumber={sequenceNumber} />
            <Text>{name}</Text>
          </Flex>
        );
      },
      accessorKey: experimentId,
      cell: ({ row }) => {
        const runComparisonItem = row.original.runComparisonMap[experimentId];
        const numRuns = runComparisonItem?.runs.length || 0;
        if (numRuns === 0) {
          return <NotRunText />;
        } else if (numRuns > 1) {
          // TODO: Support repetitions
          return <Text color="warning">{`${numRuns} runs`}</Text>;
        }
        // Only show the first run
        const run = runComparisonItem?.runs[0];
        return run ? (
          <ExperimentRunOutput {...run} displayFullText={displayFullText} />
        ) : (
          <NotRunText />
        );
      },
    })
  );

  const actionColumns: ColumnDef<TableRow>[] = [
    {
      id: "actions",
      cell: ({ row }) => (
        <ExperimentRowActionMenu
          datasetId={datasetId}
          exampleId={row.original.id}
        />
      ),
      size: 10,
    },
  ];
  const table = useReactTable<TableRow>({
    columns: [...baseColumns, ...experimentColumns, ...actionColumns],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    defaultColumn: {
      size: 50,
      minSize: 50,
    },
  });
  const rows = table.getRowModel().rows;

  const isEmpty = rows.length === 0;

  // Make sure the table is at least 1280px wide
  const tableTotalSize =
    table.getTotalSize() > 1280 ? table.getTotalSize() + "px" : "100%";
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
    >
      <table
        css={(theme) => css(tableCSS(theme), borderedTableCSS)}
        style={{
          width: tableTotalSize,
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
                    ...getCommonPinningStyles(header.column as Column<unknown>),
                  }}
                >
                  <div>
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
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td
                      key={cell.id}
                      style={{
                        ...getCommonPinningStyles(
                          cell.column as Column<unknown>
                        ),
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

enum ExperimentRowAction {
  GO_TO_EXAMPLE = "gotoExample",
}
function ExperimentRowActionMenu(props: {
  datasetId: string;
  exampleId: string;
}) {
  const { datasetId, exampleId } = props;
  const navigate = useNavigate();
  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        buttonSize="compact"
        align="end"
        onAction={(firedAction) => {
          const action = firedAction as ExperimentRowAction;
          switch (action) {
            case ExperimentRowAction.GO_TO_EXAMPLE: {
              return navigate(`/datasets/${datasetId}/examples/${exampleId}`);
            }
            default: {
              assertUnreachable(action);
            }
          }
        }}
      >
        <Item key={ExperimentRowAction.GO_TO_EXAMPLE}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.ExternalLinkOutline />} />
            <Text>Go to example</Text>
          </Flex>
        </Item>
      </ActionMenu>
    </div>
  );
}

/**
 * Display the output of an experiment run.
 */
function ExperimentRunOutput(
  props: ExperimentRun & { displayFullText: boolean }
) {
  const { output, error, startTime, endTime, annotations, displayFullText } =
    props;
  const latencyMs = useMemo(() => {
    let latencyMs: number | null = null;
    if (startTime && endTime) {
      latencyMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    }
    return latencyMs;
  }, [startTime, endTime]);
  if (error) {
    return (
      <Flex direction="row" gap="size-50" alignItems="center">
        <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
        <Text color="danger">{error}</Text>
      </Flex>
    );
  }
  const annotationsList = annotations?.edges.length
    ? annotations.edges.map((edge) => edge.annotation)
    : [];

  return (
    <Flex direction="column" gap="size-50" height="100%">
      <LargeTextWrap>
        <JSONText json={output} space={displayFullText ? 2 : 0} />
      </LargeTextWrap>
      {typeof latencyMs === "number" ? (
        <LatencyText latencyMs={latencyMs} />
      ) : null}
      <ul>
        {annotationsList.map((annotation) => (
          <li key={annotation.id}>
            <AnnotationLabel annotation={annotation} />
          </li>
        ))}
      </ul>
    </Flex>
  );
}

function NotRunText() {
  return (
    <Flex direction="row" gap="size-50">
      <Icon svg={<Icons.MinusCircleOutline />} color="grey-800" />
      <Text color="text-700">not run</Text>
    </Flex>
  );
}

function JSONCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  return (
    <LargeTextWrap>
      <JSONText json={value} space={2} />
    </LargeTextWrap>
  );
}

function LargeTextWrap({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        max-height: 300px;
        overflow-y: auto;
      `}
    >
      {children}
    </div>
  );
}
