import React, { ReactNode, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
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

import {
  ActionMenu,
  Card,
  CardProps,
  Dialog,
  DialogContainer,
  Flex,
  Heading,
  Icon,
  Icons,
  Item,
  Text,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton, ViewSummaryAside } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { JSONText } from "@phoenix/components/code/JSONText";
import { AnnotationLabel } from "@phoenix/components/experiment";
import { SequenceNumberLabel } from "@phoenix/components/experiment/SequenceNumberLabel";
import { resizeHandleCSS } from "@phoenix/components/resize";
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

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  variant: "compact",
  collapsible: true,
  bodyStyle: {
    padding: 0,
  },
};

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
  const [selectedExample, setSelectedExample] = useState<TableRow | null>();
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
              <tr
                key={row.id}
                onClick={() => {
                  setSelectedExample(row.original);
                }}
              >
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
      <DialogContainer
        isDismissable
        type="slideOver"
        onDismiss={() => {
          setSelectedExample(null);
        }}
      >
        {selectedExample ? (
          <Dialog
            title={`Comparing Experiments for Example: ${selectedExample.id}`}
            size="fullscreen"
            extra={
              <ExperimentRowActionMenu
                datasetId={datasetId}
                exampleId={selectedExample.id}
              />
            }
          >
            <PanelGroup
              direction="vertical"
              autoSaveId="example-compare-panel-group"
            >
              <Panel defaultSize={100}>
                <div
                  css={css`
                    overflow-y: auto;
                    height: 100%;
                  `}
                >
                  <View overflow="hidden" padding="size-200">
                    <Flex direction="row" gap="size-200" flex="1 1 auto">
                      <View width="50%">
                        <Card
                          title="Input"
                          {...defaultCardProps}
                          bodyStyle={{
                            padding: 0,
                            maxHeight: "300px",
                            overflowY: "auto",
                          }}
                          extra={
                            <CopyToClipboardButton
                              text={JSON.stringify(selectedExample.input)}
                            />
                          }
                        >
                          <JSONBlock
                            value={JSON.stringify(
                              selectedExample.input,
                              null,
                              2
                            )}
                          />
                        </Card>
                      </View>
                      <View width="50%">
                        <Card
                          title="Reference Output"
                          {...defaultCardProps}
                          extra={
                            <CopyToClipboardButton
                              text={JSON.stringify(selectedExample.input)}
                            />
                          }
                          bodyStyle={{
                            padding: 0,
                            maxHeight: "300px",
                            overflowY: "auto",
                          }}
                        >
                          <JSONBlock
                            value={JSON.stringify(
                              selectedExample.referenceOutput,
                              null,
                              2
                            )}
                          />
                        </Card>
                      </View>
                    </Flex>
                  </View>
                </div>
              </Panel>
              <PanelResizeHandle css={resizeHandleCSS} />
              <Panel defaultSize={200}>
                <Flex direction="column" height="100%">
                  <View
                    paddingStart="size-200"
                    paddingEnd="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-100"
                    borderBottomColor="dark"
                    borderBottomWidth="thin"
                    flex="none"
                  >
                    <Heading level={2}>Experiments</Heading>
                  </View>
                  <div
                    css={css`
                      overflow-y: auto;
                      height: 100%;
                      padding: var(--ac-global-dimension-static-size-200);
                    `}
                  >
                    <ul
                      css={css`
                        display: flex;
                        flex-direction: column;
                        gap: var(--ac-global-dimension-static-size-200);
                      `}
                    >
                      {selectedExample.runComparisonItems.map((runItem) => {
                        const experiment =
                          experimentInfoById[runItem.experimentId];
                        return (
                          <li key={runItem.experimentId}>
                            <Card
                              {...defaultCardProps}
                              title={experiment?.name}
                              titleExtra={
                                <SequenceNumberLabel
                                  sequenceNumber={
                                    experiment?.sequenceNumber || 0
                                  }
                                />
                              }
                            >
                              <ul>
                                {runItem.runs.map((run, index) => (
                                  <li key={index}>
                                    <Flex direction="row">
                                      <View flex>
                                        {run.error ? (
                                          <View padding="size-200">
                                            <RunError error={run.error} />
                                          </View>
                                        ) : (
                                          <JSONBlock
                                            value={JSON.stringify(
                                              run.output,
                                              null,
                                              2
                                            )}
                                          />
                                        )}
                                      </View>
                                      <ViewSummaryAside width="size-3000">
                                        <RunLatency
                                          startTime={run.startTime}
                                          endTime={run.endTime}
                                        />
                                        <ul
                                          css={css`
                                            margin-top: var(
                                              --ac-global-dimension-static-size-100
                                            );
                                            display: flex;
                                            flex-direction: column;
                                            gap: var(
                                              --ac-global-dimension-static-size-100
                                            );
                                          `}
                                        >
                                          {run.annotations?.edges.map(
                                            (edge) => (
                                              <li key={edge.annotation.id}>
                                                <AnnotationLabel
                                                  annotation={edge.annotation}
                                                />
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      </ViewSummaryAside>
                                    </Flex>
                                  </li>
                                ))}
                              </ul>
                            </Card>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Flex>
              </Panel>
            </PanelGroup>
          </Dialog>
        ) : null}
      </DialogContainer>
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
  if (error) {
    return <RunError error={error} />;
  }
  const annotationsList = annotations?.edges.length
    ? annotations.edges.map((edge) => edge.annotation)
    : [];

  return (
    <Flex direction="column" gap="size-50" height="100%">
      <LargeTextWrap>
        <JSONText json={output} space={displayFullText ? 2 : 0} />
      </LargeTextWrap>
      <RunLatency startTime={startTime} endTime={endTime} />
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

function RunError({ error }: { error: string }) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
      <Text color="danger">{error}</Text>
    </Flex>
  );
}

function RunLatency({
  startTime,
  endTime,
}: {
  startTime: string;
  endTime: string;
}) {
  const latencyMs = useMemo(() => {
    let latencyMs: number | null = null;
    if (startTime && endTime) {
      latencyMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    }
    return latencyMs;
  }, [startTime, endTime]);
  if (latencyMs === null) {
    return null;
  }
  return <LatencyText latencyMs={latencyMs} />;
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
