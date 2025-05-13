import React, {
  ReactNode,
  startTransition,
  Suspense,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useSearchParams } from "react-router";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  ActionMenu,
  Card,
  CardProps,
  Dialog,
  DialogContainer,
  Item,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

import {
  Button,
  CopyToClipboardButton,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
  ViewSummaryAside,
} from "@phoenix/components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { JSONBlock } from "@phoenix/components/code";
import { JSONText } from "@phoenix/components/code/JSONText";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  CellWithControlsWrap,
  CompactJSONCell,
} from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { ExampleDetailsDialog } from "@phoenix/pages/example/ExampleDetailsDialog";
import { assertUnreachable } from "@phoenix/typeUtils";

import { TraceDetails } from "../trace";

import {
  ExperimentCompareTableQuery,
  ExperimentCompareTableQuery$data,
} from "./__generated__/ExperimentCompareTableQuery.graphql";
import { ExperimentRunFilterConditionField } from "./ExperimentRunFilterConditionField";

type ExampleCompareTableProps = {
  datasetId: string;
  experimentIds: string[];
  /**
   * Whether to display the full text of the text fields
   */
  displayFullText: boolean;
};

type ExperimentInfoMap = Record<
  string,
  | {
      name: string;
      sequenceNumber: number;
      metadata: object;
      projectId: string | null;
    }
  | undefined
>;

type TableRow = ExperimentCompareTableQuery$data["comparisons"][number] & {
  id: string;
  input: unknown;
  referenceOutput: unknown;
  runComparisonMap: Record<
    string,
    ExperimentCompareTableQuery$data["comparisons"][number]["runComparisonItems"][number]
  >;
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

const tableWrapCSS = css`
  flex: 1 1 auto;
  overflow: auto;
  // Make sure the table fills up the remaining space
  table {
    min-width: 100%;
    td {
      vertical-align: top;
    }
  }
`;

const annotationTooltipExtraCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  color: var(--ac-global-color-primary);
  gap: var(--ac-global-dimension-size-50);
`;

export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  const { datasetId, experimentIds, displayFullText } = props;
  const [filterCondition, setFilterCondition] = useState("");
  const [, setSearchParams] = useSearchParams();

  const data = useLazyLoadQuery<ExperimentCompareTableQuery>(
    graphql`
      query ExperimentCompareTableQuery(
        $experimentIds: [ID!]!
        $datasetId: ID!
        $filterCondition: String
      ) {
        comparisons: compareExperiments(
          experimentIds: $experimentIds
          filterCondition: $filterCondition
        ) {
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
              trace {
                traceId
                projectId
              }
              annotations {
                edges {
                  annotation: node {
                    id
                    name
                    score
                    label
                    annotatorKind
                    explanation
                    trace {
                      traceId
                      projectId
                    }
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
                  metadata
                  project {
                    id
                  }
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
      filterCondition,
    }
  );
  const experimentInfoById = useMemo(() => {
    return (
      data.dataset?.experiments?.edges.reduce((acc, edge) => {
        acc[edge.experiment.id] = {
          ...edge.experiment,
          projectId: edge.experiment?.project?.id || null,
        };
        return acc;
      }, {} as ExperimentInfoMap) || {}
    );
  }, [data]);
  const tableData: TableRow[] = useMemo(
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

  const [dialog, setDialog] = useState<ReactNode>(null);
  const baseColumns: ColumnDef<TableRow>[] = useMemo(() => {
    return [
      {
        header: "input",
        accessorKey: "input",
        minWidth: 500,
        cell: ({ row }) => {
          return (
            <CellWithControlsWrap
              controls={
                <TooltipTrigger>
                  <Button
                    size="S"
                    aria-label="View example details"
                    leadingVisual={<Icon svg={<Icons.ExpandOutline />} />}
                    onPress={() => {
                      startTransition(() => {
                        setDialog(
                          <Suspense>
                            <ExampleDetailsDialog
                              exampleId={row.original.example.id}
                              onDismiss={() => {
                                setDialog(null);
                              }}
                            />
                          </Suspense>
                        );
                      });
                    }}
                  />
                  <Tooltip>View Example</Tooltip>
                </TooltipTrigger>
              }
            >
              <PaddedCell>
                <LargeTextWrap>
                  <JSONText
                    json={row.original.input}
                    disableTitle
                    space={displayFullText ? 2 : 0}
                  />
                </LargeTextWrap>
              </PaddedCell>
            </CellWithControlsWrap>
          );
        },
      },
      {
        header: "reference output",
        accessorKey: "referenceOutput",
        minWidth: 500,
        cell: (props) => (
          <PaddedCell>
            {displayFullText ? JSONCell(props) : CompactJSONCell(props)}
          </PaddedCell>
        ),
      },
    ];
  }, [displayFullText]);

  const experimentColumns: ColumnDef<TableRow>[] = useMemo(() => {
    return experimentIds.map((experimentId) => ({
      header: () => {
        const name = experimentInfoById[experimentId]?.name;
        const metadata = experimentInfoById[experimentId]?.metadata;
        const projectId = experimentInfoById[experimentId]?.projectId;
        const sequenceNumber =
          experimentInfoById[experimentId]?.sequenceNumber || 0;
        return (
          <Flex
            direction="row"
            gap="size-100"
            wrap
            alignItems="center"
            justifyContent="space-between"
          >
            <Flex direction="row" gap="size-100" wrap alignItems="center">
              <SequenceNumberToken sequenceNumber={sequenceNumber} />
              <Text>{name}</Text>
            </Flex>
            <ExperimentActionMenu
              experimentId={experimentId}
              metadata={metadata}
              isQuiet={true}
              projectId={projectId}
              canDeleteExperiment={false}
            />
          </Flex>
        );
      },
      accessorKey: experimentId,
      minSize: 500,
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

        let traceButton = null;
        const traceId = run?.trace?.traceId;
        const projectId = run?.trace?.projectId;
        if (traceId && projectId) {
          traceButton = (
            <TooltipTrigger>
              <Button
                variant="default"
                className="trace-button"
                size="S"
                aria-label="View run trace"
                leadingVisual={<Icon svg={<Icons.Trace />} />}
                onPress={() => {
                  startTransition(() => {
                    setDialog(
                      <TraceDetailsDialog
                        traceId={traceId}
                        projectId={projectId}
                        title={`Experiment Run Trace`}
                      />
                    );
                  });
                }}
              />
              <Tooltip>View Trace</Tooltip>
            </TooltipTrigger>
          );
        }
        const runControls = (
          <>
            <TooltipTrigger>
              <Button
                variant="default"
                className="expand-button"
                size="S"
                aria-label="View example run details"
                leadingVisual={<Icon svg={<Icons.ExpandOutline />} />}
                onPress={() => {
                  startTransition(() => {
                    setDialog(
                      <SelectedExampleDialog
                        selectedExample={row.original}
                        datasetId={datasetId}
                        experimentInfoById={experimentInfoById}
                      />
                    );
                  });
                }}
              />
              <Tooltip>View run details</Tooltip>
            </TooltipTrigger>
            {traceButton}
          </>
        );

        return run ? (
          <CellWithControlsWrap controls={runControls}>
            <PaddedCell>
              <ExperimentRunOutput
                {...run}
                displayFullText={displayFullText}
                setDialog={setDialog}
              />
            </PaddedCell>
          </CellWithControlsWrap>
        ) : (
          <PaddedCell>
            <NotRunText />
          </PaddedCell>
        );
      },
    }));
  }, [experimentIds, experimentInfoById, datasetId, displayFullText]);

  const columns = useMemo(() => {
    return [...baseColumns, ...experimentColumns];
  }, [baseColumns, experimentColumns]);

  const table = useReactTable<TableRow>({
    columns: columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  const rows = table.getRowModel().rows;

  const isEmpty = rows.length === 0;

  return (
    <View overflow="auto">
      <Flex direction="column" height="100%">
        <View
          paddingTop="size-100"
          paddingBottom="size-100"
          paddingStart="size-200"
          paddingEnd="size-200"
          borderBottomColor="grey-300"
          borderBottomWidth="thin"
          flex="none"
        >
          <ExperimentRunFilterConditionField
            onValidCondition={setFilterCondition}
          />
        </View>
        <div css={tableWrapCSS}>
          <table
            css={css(tableCSS, borderedTableCSS)}
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
                      style={{
                        width: `calc(var(--header-${header?.id}-size) * 1px)`,
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
            ) : table.getState().columnSizingInfo.isResizingColumn ? (
              /* When resizing any column we will render this special memoized version of our table body */
              <MemoizedTableBody table={table} />
            ) : (
              <TableBody table={table} />
            )}
          </table>
          <DialogContainer
            isDismissable
            type="slideOver"
            onDismiss={() => {
              setDialog(null);
              setSearchParams((searchParams) => {
                searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                return searchParams;
              });
            }}
          >
            {dialog}
          </DialogContainer>
        </div>
      </Flex>
    </View>
  );
}

//un-memoized normal table body component - see memoized version below
function TableBody<T>({ table }: { table: Table<T> }) {
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => (
        <tr key={row.id}>
          {row.getVisibleCells().map((cell) => {
            return (
              <td
                key={cell.id}
                style={{
                  width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                  padding: 0,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

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
  props: ExperimentRun & {
    displayFullText: boolean;
    setDialog: (dialog: ReactNode) => void;
  }
) {
  const {
    output,
    error,
    startTime,
    endTime,
    annotations,
    displayFullText,
    setDialog,
  } = props;
  if (error) {
    return <RunError error={error} />;
  }
  const annotationsList = annotations?.edges.length
    ? annotations.edges.map((edge) => edge.annotation)
    : [];

  return (
    <Flex
      direction="column"
      gap="size-100"
      height="100%"
      justifyContent="space-between"
    >
      <LargeTextWrap>
        <JSONText json={output} disableTitle space={displayFullText ? 2 : 0} />
      </LargeTextWrap>
      <ul
        css={css`
          display: flex;
          flex-direction: row;
          gap: var(--ac-global-dimension-static-size-100);
          align-items: center;
          flex-wrap: wrap;
        `}
      >
        <li key="run-latency">
          <RunLatency startTime={startTime} endTime={endTime} />
        </li>
        {annotationsList.map((annotation) => (
          <li key={annotation.id}>
            <AnnotationTooltip
              annotation={annotation}
              extra={
                annotation.trace && (
                  <View paddingTop="size-100">
                    <div css={annotationTooltipExtraCSS}>
                      <Icon svg={<Icons.InfoOutline />} />
                      <span>Click to view evaluator trace</span>
                    </div>
                  </View>
                )
              }
            >
              <AnnotationLabel
                annotation={annotation}
                onClick={() => {
                  const trace = annotation.trace;
                  if (trace) {
                    startTransition(() => {
                      setDialog(
                        <TraceDetailsDialog
                          traceId={trace.traceId}
                          projectId={trace.projectId}
                          title={`Evaluator Trace: ${annotation.name}`}
                        />
                      );
                    });
                  }
                }}
              />
            </AnnotationTooltip>
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

function SelectedExampleDialog({
  selectedExample,
  datasetId,
  experimentInfoById,
}: {
  selectedExample: TableRow;
  datasetId: string;
  experimentInfoById: ExperimentInfoMap;
}) {
  return (
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
      <PanelGroup direction="vertical" autoSaveId="example-compare-panel-group">
        <Panel defaultSize={35}>
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
                      value={JSON.stringify(selectedExample.input, null, 2)}
                    />
                  </Card>
                </View>
                <View width="50%">
                  <Card
                    title="Reference Output"
                    {...defaultCardProps}
                    extra={
                      <CopyToClipboardButton
                        text={JSON.stringify(selectedExample.referenceOutput)}
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
        <Panel defaultSize={65}>
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
                  const experiment = experimentInfoById[runItem.experimentId];
                  return (
                    <li key={runItem.experimentId}>
                      <Card
                        {...defaultCardProps}
                        title={experiment?.name}
                        titleExtra={
                          <SequenceNumberToken
                            sequenceNumber={experiment?.sequenceNumber || 0}
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
                                      justify-content: flex-start;
                                      align-items: flex-end;
                                      gap: var(
                                        --ac-global-dimension-static-size-100
                                      );
                                    `}
                                  >
                                    {run.annotations?.edges.map((edge) => (
                                      <li key={edge.annotation.id}>
                                        <AnnotationLabel
                                          annotation={edge.annotation}
                                        />
                                      </li>
                                    ))}
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
  );
}

function TraceDetailsDialog({
  traceId,
  projectId,
  title,
}: {
  traceId: string;
  projectId: string;
  title: string;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      title={title}
      size="fullscreen"
      extra={
        <Button
          onPress={() => navigate(`/projects/${projectId}/traces/${traceId}`)}
        >
          View Trace in Project
        </Button>
      }
    >
      <TraceDetails traceId={traceId} projectId={projectId} />
    </Dialog>
  );
}

function PaddedCell({ children }: { children: ReactNode }) {
  return (
    <View paddingX="size-200" paddingY="size-100">
      {children}
    </View>
  );
}
