import React, {
  ReactNode,
  RefObject,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable } from "react-aria-components";
import { graphql, usePaginationFragment } from "react-relay";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import {
  Button,
  Card,
  CardProps,
  CopyToClipboardButton,
  Dialog,
  DialogCloseButton,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  ListBox,
  ListBoxItem,
  Loading,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  Separator,
  Text,
  View,
  ViewSummaryAside,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { JSONBlock } from "@phoenix/components/code";
import { JSONText } from "@phoenix/components/code/JSONText";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import {
  ExperimentAverageRunTokenCosts,
  ExperimentRunTokenCosts,
  ExperimentRunTokenCount,
  useExperimentColors,
} from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { ExperimentAverageRunTokenCount } from "@phoenix/components/experiment/ExperimentAverageRunTokenCount";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { CellTop, CompactJSONCell } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { ExampleDetailsDialog } from "@phoenix/pages/example/ExampleDetailsDialog";
import { ExperimentNameWithColorSwatch } from "@phoenix/pages/experiment/ExperimentNameWithColorSwatch";
import { ExperimentRunAnnotationFiltersList } from "@phoenix/pages/experiment/ExperimentRunAnnotationFiltersList";
import { assertUnreachable } from "@phoenix/typeUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import { TraceDetails } from "../trace";

import type {
  ExperimentCompareTable_comparisons$data,
  ExperimentCompareTable_comparisons$key,
} from "./__generated__/ExperimentCompareTable_comparisons.graphql";
import type { ExperimentCompareTableQuery } from "./__generated__/ExperimentCompareTableQuery.graphql";
import { ExperimentRunFilterConditionField } from "./ExperimentRunFilterConditionField";

type ExampleCompareTableProps = {
  query: ExperimentCompareTable_comparisons$key;
  datasetId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
};

type Experiment = NonNullable<
  ExperimentCompareTable_comparisons$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentInfoMap = Record<string, Experiment | null>;

type DatasetExample = NonNullable<
  ExperimentCompareTable_comparisons$data["dataset"]["examples"]
>["edges"][number]["example"];
type ExperimentRun =
  DatasetExample["experiments"]["edges"][number]["experiment"]["runs"]["edges"][number]["run"];
type ExperimentRunAnnotation =
  ExperimentRun["annotations"]["edges"][number]["annotation"];

type TableRow = {
  example: DatasetExample;
  runsMap: Record<string, ExperimentRun[]>;
};

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
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

const PAGE_SIZE = 50;
export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [displayFullText, setDisplayFullText] = useState(false);
  const { datasetId, baseExperimentId, compareExperimentIds } = props;
  const [filterCondition, setFilterCondition] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      ExperimentCompareTableQuery,
      ExperimentCompareTable_comparisons$key
    >(
      graphql`
        fragment ExperimentCompareTable_comparisons on Query
        @refetchable(queryName: "ExperimentCompareTableQuery")
        @argumentDefinitions(
          first: { type: "Int", defaultValue: 50 }
          after: { type: "String", defaultValue: null }
          experimentIds: { type: "[ID!]!" }
          datasetId: { type: "ID!" }
          datasetVersionId: { type: "ID!" }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          dataset: node(id: $datasetId) {
            id
            ... on Dataset {
              examples(
                first: $first
                after: $after
                datasetVersionId: $datasetVersionId
                filterCondition: $filterCondition
              ) @connection(key: "ExperimentCompareTable_examples") {
                edges {
                  example: node {
                    id
                    revision {
                      input
                      referenceOutput: output
                    }
                    experiments(experimentIds: $experimentIds) {
                      edges {
                        experiment: node {
                          id
                          runCount
                          runs(first: 5) {
                            edges {
                              run: node {
                                id
                                output
                                error
                                startTime
                                endTime
                                trace {
                                  traceId
                                  projectId
                                }
                                costSummary {
                                  total {
                                    tokens
                                    cost
                                  }
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
                        }
                      }
                    }
                  }
                }
              }
              experiments(experimentIds: $experimentIds) {
                edges {
                  experiment: node {
                    id
                    name
                    sequenceNumber
                    metadata
                    project {
                      id
                    }
                    costSummary {
                      total {
                        cost
                        tokens
                      }
                    }
                    averageRunLatencyMs
                    runCount
                  }
                }
              }
            }
          }
        }
      `,
      props.query
    );
  const experimentInfoById = useMemo(() => {
    return (
      data.dataset?.experiments?.edges.reduce((acc, edge) => {
        acc[edge.experiment.id] = {
          ...edge.experiment,
        };
        return acc;
      }, {} as ExperimentInfoMap) || {}
    );
  }, [data]);
  const tableData: TableRow[] = useMemo(
    () =>
      data.dataset.examples?.edges.map((edge) => {
        const example = edge.example;
        const runsMap = example.experiments.edges.reduce(
          (acc, item) => {
            acc[item.experiment.id] = item.experiment.runs.edges.map(
              (edge) => edge.run
            );
            return acc;
          },
          {} as Record<string, ExperimentRun[]>
        );
        return {
          example,
          runsMap,
        };
      }) || [],
    [data]
  );

  const baseColumns: ColumnDef<TableRow>[] = useMemo(() => {
    return [
      {
        header: "input",
        accessorKey: "input",
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <Flex
              direction="column"
              height="100%"
              css={css`
                overflow: hidden;
              `}
            >
              <CellTop
                extra={
                  <TooltipTrigger>
                    <IconButton
                      size="S"
                      onPress={() => {
                        setDialog(
                          <ExampleDetailsDialog
                            exampleId={row.original.example.id}
                          />
                        );
                      }}
                    >
                      <Icon svg={<Icons.ExpandOutline />} />
                    </IconButton>
                    <Tooltip>
                      <TooltipArrow />
                      view example
                    </Tooltip>
                  </TooltipTrigger>
                }
              >
                <Text
                  size="S"
                  color="text-500"
                >{`example ${row.original.example.id}`}</Text>
              </CellTop>

              <PaddedCell>
                <LargeTextWrap>
                  <JSONText
                    json={row.original.example.revision.input}
                    disableTitle
                    space={displayFullText ? 2 : 0}
                  />
                </LargeTextWrap>
              </PaddedCell>
            </Flex>
          );
        },
      },
      {
        header: "reference output",
        accessorKey: "referenceOutput",
        enableSorting: false,
        cell: (props) => (
          <>
            <CellTop>
              <Text size="S" color="text-500">
                reference
              </Text>
            </CellTop>
            <PaddedCell>
              {displayFullText ? JSONCell(props) : CompactJSONCell(props)}
            </PaddedCell>
          </>
        ),
      },
    ];
  }, [displayFullText, setDialog]);

  const experimentColumns: ColumnDef<TableRow>[] = useMemo(() => {
    return [baseExperimentId, ...compareExperimentIds].map(
      (experimentId, experimentIndex) => ({
        header: () => {
          const experiment = experimentInfoById[experimentId];
          const name = experiment?.name || "unknown-experiment";
          const metadata = experiment?.metadata;
          const projectId = experiment?.project?.id;
          const experimentColor =
            experimentIndex === 0
              ? baseExperimentColor
              : getExperimentColor(experimentIndex - 1);
          return (
            <Flex
              direction="row"
              gap="size-100"
              wrap
              alignItems="center"
              justifyContent="space-between"
            >
              <Flex direction="column" gap="size-50">
                <ExperimentNameWithColorSwatch
                  name={name}
                  color={experimentColor}
                />
                <div>
                  {experiment && <ExperimentMetadata experiment={experiment} />}
                </div>
              </Flex>
              <Flex
                direction="row"
                wrap
                justifyContent="end"
                alignItems="center"
              >
                <ExperimentActionMenu
                  experimentId={experimentId}
                  metadata={metadata}
                  isQuiet={true}
                  projectId={projectId}
                  canDeleteExperiment={false}
                />
              </Flex>
            </Flex>
          );
        },
        accessorKey: experimentId,
        minSize: 500,
        enableSorting: false,
        cell: ({ row }) => {
          const runs = row.original.runsMap[experimentId];
          const numRuns = runs?.length || 0;
          if (numRuns === 0) {
            return (
              <PaddedCell>
                <NotRunText />
              </PaddedCell>
            );
          } else if (numRuns > 1) {
            // TODO: Support repetitions
            return <Text color="warning">{`${numRuns} runs`}</Text>;
          }
          // Only show the first run
          const run = runs[0];

          let traceButton = null;
          const traceId = run.trace?.traceId;
          const projectId = run.trace?.projectId;
          if (traceId && projectId) {
            traceButton = (
              <TooltipTrigger>
                <IconButton
                  className="trace-button"
                  size="S"
                  aria-label="View run trace"
                  onPress={() => {
                    setDialog(
                      <TraceDetailsDialog
                        traceId={traceId}
                        projectId={projectId}
                        title={`Experiment Run Trace`}
                      />
                    );
                  }}
                >
                  <Icon svg={<Icons.Trace />} />
                </IconButton>
                <Tooltip>
                  <TooltipArrow />
                  view run trace
                </Tooltip>
              </TooltipTrigger>
            );
          }
          const runControls = (
            <>
              <TooltipTrigger>
                <IconButton
                  className="expand-button"
                  size="S"
                  aria-label="View example run details"
                  onPress={() => {
                    setDialog(
                      <SelectedExampleDialog
                        selectedExample={row.original}
                        datasetId={datasetId}
                        experimentInfoById={experimentInfoById}
                      />
                    );
                  }}
                >
                  <Icon svg={<Icons.ExpandOutline />} />
                </IconButton>
                <Tooltip>
                  <TooltipArrow />
                  view experiment run
                </Tooltip>
              </TooltipTrigger>
              {traceButton}
            </>
          );

          return run ? (
            <Flex direction="column" height="100%">
              <CellTop extra={runControls}>
                <ExperimentRunMetadata {...run} />
              </CellTop>
              <ExperimentRunOutput
                {...run}
                displayFullText={displayFullText}
                setDialog={setDialog}
              />
            </Flex>
          ) : (
            <PaddedCell>
              <NotRunText />
            </PaddedCell>
          );
        },
      })
    );
  }, [
    baseExperimentId,
    baseExperimentColor,
    compareExperimentIds,
    datasetId,
    displayFullText,
    experimentInfoById,
    getExperimentColor,
  ]);

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
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

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

  useEffect(() => {
    //if the filter condition changes, we need to reset the pagination
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
          filterCondition,
          experimentIds: [baseExperimentId, ...compareExperimentIds],
          datasetId,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [
    datasetId,
    baseExperimentId,
    compareExperimentIds,
    filterCondition,
    refetch,
  ]);

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
          <Flex direction="row" gap="size-200" alignItems="center">
            <ExperimentRunFilterConditionField
              onValidCondition={setFilterCondition}
            />
            <Switch
              onChange={(isSelected) => {
                setDisplayFullText(isSelected);
              }}
              defaultSelected={false}
              labelPlacement="start"
            >
              <Text>Full Text</Text>
            </Switch>
          </Flex>
        </View>
        <div
          css={tableWrapCSS}
          onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
          ref={tableContainerRef}
        >
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
                      colSpan={header.colSpan}
                      style={{
                        width: `calc(var(--header-${makeSafeColumnId(header?.id)}-size) * 1px)`,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          <div
                            {...{
                              className: header.column.getCanSort()
                                ? "sort"
                                : "",
                              onClick: header.column.getToggleSortingHandler(),
                              style: {
                                left: header.getStart(),
                                width: "100%",
                              },
                            }}
                          >
                            <Truncate maxWidth="100%">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </Truncate>
                            {header.column.getIsSorted() ? (
                              <Icon
                                className="sort-icon"
                                svg={
                                  header.column.getIsSorted() === "asc" ? (
                                    <Icons.ArrowUpFilled />
                                  ) : (
                                    <Icons.ArrowDownFilled />
                                  )
                                }
                              />
                            ) : null}
                          </div>
                          <div
                            {...{
                              onMouseDown: header.getResizeHandler(),
                              onTouchStart: header.getResizeHandler(),
                              className: `resizer ${
                                header.column.getIsResizing()
                                  ? "isResizing"
                                  : ""
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
              <TableEmpty />
            ) : table.getState().columnSizingInfo.isResizingColumn ? (
              /* When resizing any column we will render this special memoized version of our table body */
              <MemoizedTableBody
                table={table}
                tableContainerRef={tableContainerRef}
              />
            ) : (
              <TableBody table={table} tableContainerRef={tableContainerRef} />
            )}
          </table>
        </div>
      </Flex>
      <ModalOverlay
        isOpen={!!dialog}
        onOpenChange={() => {
          // Clear the URL search params for the span selection
          searchParams.delete("selectedSpanNodeId");
          setSearchParams(searchParams, { replace: true });
          setDialog(null);
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {/* TODO: move this into the dialogs so the loading state is contained */}
          <Suspense>{dialog}</Suspense>
        </Modal>
      </ModalOverlay>
    </View>
  );
}

//un-memoized normal table body component - see memoized version below
function TableBody<T>({
  table,
  tableContainerRef,
}: {
  table: Table<T>;
  tableContainerRef: RefObject<HTMLDivElement>;
}) {
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 350,
    overscan: 5,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const spacerRowHeight = useMemo(() => {
    return totalHeight - virtualRows.reduce((acc, item) => acc + item.size, 0);
  }, [totalHeight, virtualRows]);

  return (
    <tbody>
      {virtualRows.map((virtualRow, index) => {
        const row = rows[virtualRow.index];
        return (
          <tr
            key={row.id}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${
                virtualRow.start - index * virtualRow.size
              }px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  style={{
                    width: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                    maxWidth: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                    padding: 0,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
      {/* Add a spacer row to ensure the sticky header does not scroll out of view and to make scrolling smoother */}
      <tr>
        <td
          style={{
            height: `${spacerRowHeight}px`,
            padding: 0,
          }}
          colSpan={table.getAllColumns().length}
        />
      </tr>
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
      <DialogTrigger>
        <TooltipTrigger>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
          />
          <Tooltip>
            <TooltipArrow />
            More actions
          </Tooltip>
        </TooltipTrigger>
        <Popover>
          <Dialog>
            {({ close }) => (
              <ListBox
                style={{ minHeight: "auto" }}
                onAction={(firedAction) => {
                  const action = firedAction as ExperimentRowAction;
                  switch (action) {
                    case ExperimentRowAction.GO_TO_EXAMPLE: {
                      navigate(`/datasets/${datasetId}/examples/${exampleId}`);
                      break;
                    }
                    default: {
                      assertUnreachable(action);
                    }
                  }
                  close();
                }}
              >
                <ListBoxItem id={ExperimentRowAction.GO_TO_EXAMPLE}>
                  <Flex
                    direction="row"
                    gap="size-75"
                    justifyContent="start"
                    alignItems="center"
                  >
                    <Icon svg={<Icons.ExternalLinkOutline />} />
                    <Text>Go to example</Text>
                  </Flex>
                </ListBoxItem>
              </ListBox>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}

function ExperimentMetadata(props: { experiment: Experiment }) {
  const { experiment } = props;
  const averageRunLatencyMs = experiment.averageRunLatencyMs;
  const runCount = experiment.runCount;
  const costTotal = experiment.costSummary.total.cost;
  const tokenCountTotal = experiment.costSummary.total.tokens;
  const averageRunCostTotal =
    costTotal == null || runCount == 0 ? null : costTotal / runCount;
  const averageRunTokenCountTotal =
    tokenCountTotal == null || runCount == 0
      ? null
      : tokenCountTotal / runCount;
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Text size="S">avg:</Text>
      {averageRunLatencyMs != null && (
        <LatencyText size="S" latencyMs={averageRunLatencyMs} />
      )}
      <ExperimentAverageRunTokenCount
        averageRunTokenCountTotal={averageRunTokenCountTotal}
        experimentId={experiment.id}
        size="S"
      />
      {averageRunCostTotal != null && (
        <ExperimentAverageRunTokenCosts
          averageRunCostTotal={averageRunCostTotal}
          experimentId={experiment.id}
          size="S"
        />
      )}
    </Flex>
  );
}

function ExperimentRunMetadata(props: ExperimentRun) {
  const { id, startTime, endTime, costSummary } = props;
  const tokenCountTotal = costSummary.total.tokens;
  const costTotal = costSummary.total.cost;
  return (
    <Flex direction="row" gap="size-100">
      <RunLatency startTime={startTime} endTime={endTime} />
      {tokenCountTotal != null && id ? (
        <ExperimentRunTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRunId={id}
          size="S"
        />
      ) : (
        <TokenCount size="S">{tokenCountTotal}</TokenCount>
      )}
      {costTotal != null && id ? (
        <ExperimentRunTokenCosts
          costTotal={costTotal}
          experimentRunId={id}
          size="S"
        />
      ) : null}
    </Flex>
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
  const { output, error, annotations, displayFullText, setDialog } = props;
  if (error) {
    return <RunError error={error} />;
  }
  const annotationsList = annotations?.edges.length
    ? annotations.edges.map((edge) => edge.annotation)
    : [];

  return (
    <Flex direction="column" height="100%" justifyContent="space-between">
      <View padding="size-200" flex="1 1 auto">
        <LargeTextWrap>
          <JSONText
            json={output}
            disableTitle
            space={displayFullText ? 2 : 0}
          />
        </LargeTextWrap>
      </View>
      <ExperimentRunCellAnnotationsList
        annotations={annotationsList}
        onTraceClick={({ traceId, projectId, annotationName }) => {
          setDialog(
            <TraceDetailsDialog
              title={`Evaluator Trace: ${annotationName}`}
              traceId={traceId}
              projectId={projectId}
            />
          );
        }}
      />
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
  return <LatencyText size="S" latencyMs={latencyMs} />;
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
        flex: 1 1 auto;
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
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Comparing Experiments for Example: ${selectedExample.id}`}</DialogTitle>
          <DialogTitleExtra>
            <ExperimentRowActionMenu
              datasetId={datasetId}
              exampleId={selectedExample.id}
            />
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <PanelGroup
          direction="vertical"
          autoSaveId="example-compare-panel-group"
        >
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
                      extra={
                        <CopyToClipboardButton
                          text={JSON.stringify(
                            selectedExample.example.revision.input
                          )}
                        />
                      }
                    >
                      <View maxHeight="300px" overflow="auto">
                        <JSONBlock
                          value={JSON.stringify(
                            selectedExample.example.revision.input,
                            null,
                            2
                          )}
                        />
                      </View>
                    </Card>
                  </View>
                  <View width="50%">
                    <Card
                      title="Reference Output"
                      {...defaultCardProps}
                      extra={
                        <CopyToClipboardButton
                          text={JSON.stringify(
                            selectedExample.example.revision.referenceOutput
                          )}
                        />
                      }
                    >
                      <View maxHeight="300px" overflow="auto">
                        <JSONBlock
                          value={JSON.stringify(
                            selectedExample.example.revision.referenceOutput,
                            null,
                            2
                          )}
                        />
                      </View>
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
                  {Object.entries(selectedExample.runsMap).map(
                    ([experimentId, runs]) => {
                      const experiment = experimentInfoById[experimentId];
                      return (
                        <li key={experimentId}>
                          <Card
                            {...defaultCardProps}
                            title={experiment?.name ?? ""}
                            titleExtra={
                              <SequenceNumberToken
                                sequenceNumber={experiment?.sequenceNumber ?? 0}
                              />
                            }
                          >
                            <ul>
                              {runs.map((run, index) => (
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
                    }
                  )}
                </ul>
              </div>
            </Flex>
          </Panel>
        </PanelGroup>
      </DialogContent>
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
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogTitleExtra>
            <Button
              size="S"
              onPress={() =>
                navigate(`/projects/${projectId}/traces/${traceId}`)
              }
            >
              View Trace in Project
            </Button>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense fallback={<Loading />}>
          <TraceDetails traceId={traceId} projectId={projectId} />
        </Suspense>
      </DialogContent>
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

export type ExperimentRunCellAnnotationsListProps = {
  annotations: ExperimentRunAnnotation[];
  onTraceClick: ({
    annotationName,
    traceId,
    projectId,
  }: {
    annotationName: string;
    traceId: string;
    projectId: string;
  }) => void;
};

export function ExperimentRunCellAnnotationsList(
  props: ExperimentRunCellAnnotationsListProps
) {
  const { annotations, onTraceClick } = props;
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        flex: none;
        padding: 0 var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-100);
      `}
    >
      {annotations.map((annotation) => {
        const traceId = annotation.trace?.traceId;
        const projectId = annotation.trace?.projectId;
        const hasTrace = traceId != null && projectId != null;
        return (
          <li
            key={annotation.id}
            css={css`
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: var(--ac-global-dimension-static-size-50);
            `}
          >
            <DialogTrigger>
              <Pressable>
                <button
                  className="button--reset"
                  css={css`
                    cursor: pointer;
                    padding: var(--ac-global-dimension-size-50)
                      var(--ac-global-dimension-size-100);
                    flex: 1 1 auto;
                    border-radius: var(--ac-global-rounding-small);
                    width: 100%;
                    &:hover {
                      background-color: var(--ac-global-color-grey-200);
                    }
                  `}
                >
                  <AnnotationNameAndValue
                    annotation={annotation}
                    displayPreference="score"
                  />
                </button>
              </Pressable>
              <Popover placement="top">
                <PopoverArrow />
                <Dialog style={{ width: 400 }}>
                  <View padding="size-200">
                    <Flex direction="column" gap="size-50">
                      <AnnotationDetailsContent annotation={annotation} />
                      <Separator />
                      <section>
                        <Heading level={4} weight="heavy">
                          Filters
                        </Heading>
                        <ExperimentRunAnnotationFiltersList
                          annotation={annotation}
                        />
                      </section>
                    </Flex>
                  </View>
                </Dialog>
              </Popover>
            </DialogTrigger>
            <TooltipTrigger>
              <IconButton
                size="S"
                onPress={() => {
                  if (hasTrace) {
                    onTraceClick({
                      annotationName: annotation.name,
                      traceId,
                      projectId,
                    });
                  }
                }}
              >
                <Icon svg={<Icons.Trace />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                View evaluation trace
              </Tooltip>
            </TooltipTrigger>
          </li>
        );
      })}
    </ul>
  );
}
