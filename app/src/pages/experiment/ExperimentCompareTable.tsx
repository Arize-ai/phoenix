import React, {
  ReactNode,
  RefObject,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  graphql,
  PreloadedQuery,
  usePaginationFragment,
  usePreloadedQuery,
} from "react-relay";
import { useSearchParams } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { css } from "@emotion/react";

import {
  Empty,
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { type AnnotationConfig } from "@phoenix/components/annotation";
import {
  calculateAnnotationListHeight,
  calculateEstimatedRowHeight,
  CELL_PRIMARY_CONTENT_HEIGHT,
  ExperimentAnnotationAggregates,
  ExperimentCostAndLatencySummary,
  ExperimentInputCell,
  ExperimentNameWithColorSwatch,
  ExperimentOutputContent,
  ExperimentReferenceOutputCell,
  ExperimentRunCellAnnotationsList,
  useExperimentColors,
} from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { CellTop, OverflowCell, PaddedCell } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { ExampleDetailsDialog } from "@phoenix/pages/example/ExampleDetailsDialog";
import { ExperimentCompareDetailsDialog } from "@phoenix/pages/experiment/ExperimentCompareDetailsDialog";
import { ExperimentComparePageQueriesCompareGridQuery } from "@phoenix/pages/experiment/ExperimentComparePageQueries";
import { TraceDetailsDialog } from "@phoenix/pages/experiment/TraceDetailsDialog";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type {
  ExperimentCompareTable_comparisons$data,
  ExperimentCompareTable_comparisons$key,
} from "./__generated__/ExperimentCompareTable_comparisons.graphql";
import type { ExperimentCompareTableQuery as ExperimentCompareTableQueryType } from "./__generated__/ExperimentCompareTableQuery.graphql";
import { ExperimentRepeatedRunGroupMetadata } from "./ExperimentRepeatedRunGroupMetadata";
import { ExperimentRepetitionSelector } from "./ExperimentRepetitionSelector";
import { ExperimentRunFilterConditionField } from "./ExperimentRunFilterConditionField";

type ExampleCompareTableProps = {
  queryRef: PreloadedQuery<ExperimentCompareTableQueryType>;
  datasetId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
};

type Experiment = NonNullable<
  ExperimentCompareTable_comparisons$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentInfoMap = Partial<Record<string, Experiment>>;

type ExperimentComparison =
  ExperimentCompareTable_comparisons$data["compareExperiments"]["edges"][number]["comparison"];
type ExperimentRepeatedRunGroup =
  ExperimentComparison["repeatedRunGroups"][number];
type AnnotationSummary =
  ExperimentRepeatedRunGroup["annotationSummaries"][number];
type ExperimentRun = ExperimentRepeatedRunGroup["runs"][number];

type TableRow = ExperimentComparison & {
  id: string;
  input: unknown;
  referenceOutput: unknown;
  repeatedRunGroupsByExperimentId: Record<string, ExperimentRepeatedRunGroup>;
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

/**
 * We change the size of the action menu to make it align with  the other headers
 */
const actionMenuContainerCSS = css`
  position: relative;
  height: var(--ac-global-line-height-s);
  & > button {
    position: absolute;
  }
`;
const PAGE_SIZE = 50;
export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState<
    number | null
  >(null);
  const { datasetId, baseExperimentId, compareExperimentIds } = props;
  const [filterCondition, setFilterCondition] = useState("");

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [, setSearchParams] = useSearchParams();
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();

  const preloadedData = usePreloadedQuery(
    ExperimentComparePageQueriesCompareGridQuery,
    props.queryRef
  );

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      ExperimentCompareTableQueryType,
      ExperimentCompareTable_comparisons$key
    >(
      graphql`
        fragment ExperimentCompareTable_comparisons on Query
        @refetchable(queryName: "ExperimentCompareTableQuery")
        @argumentDefinitions(
          first: { type: "Int", defaultValue: 50 }
          after: { type: "String", defaultValue: null }
          baseExperimentId: { type: "ID!" }
          compareExperimentIds: { type: "[ID!]!" }
          experimentIds: { type: "[ID!]!" }
          datasetId: { type: "ID!" }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          compareExperiments(
            first: $first
            after: $after
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            filterCondition: $filterCondition
          ) @connection(key: "ExperimentCompareTable_compareExperiments") {
            edges {
              comparison: node {
                example {
                  id
                  revision {
                    input
                    referenceOutput: output
                  }
                }
                repeatedRunGroups {
                  ...ExperimentRepeatedRunGroupMetadataFragment
                  annotationSummaries {
                    annotationName
                    meanScore
                  }
                  experimentId
                  runs {
                    id
                    latencyMs
                    repetitionNumber
                    output
                    error
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
                          metadata
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
          dataset: node(id: $datasetId) {
            id
            ... on Dataset {
              experiments(filterIds: $experimentIds) {
                edges {
                  experiment: node {
                    id
                    name
                    sequenceNumber
                    metadata
                    datasetVersionId
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
                    repetitions
                    annotationSummaries {
                      annotationName
                      meanScore
                    }
                  }
                }
              }
              datasetEvaluators(first: 100) {
                edges {
                  node {
                    name
                    outputConfigs {
                      ... on CategoricalAnnotationConfig {
                        name
                        optimizationDirection
                        values {
                          label
                          score
                        }
                      }
                      ... on ContinuousAnnotationConfig {
                        name
                        optimizationDirection
                        lowerBound
                        upperBound
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      preloadedData
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

  const annotationConfigs = useMemo(() => {
    const evaluators =
      data.dataset?.datasetEvaluators?.edges.map((edge) => edge.node) ?? [];
    return datasetEvaluatorsToAnnotationConfigs(evaluators);
  }, [data]);

  const baseExperiment = experimentInfoById[baseExperimentId];

  const tableData: TableRow[] = useMemo(
    () =>
      data.compareExperiments.edges.map((edge) => {
        const comparison = edge.comparison;
        const repeatedRunGroupsByExperimentId =
          comparison.repeatedRunGroups.reduce(
            (acc, group) => {
              acc[group.experimentId] = group;
              return acc;
            },
            {} as Record<string, ExperimentRepeatedRunGroup>
          );
        return {
          ...comparison,
          id: comparison.example.id,
          input: comparison.example.revision.input,
          referenceOutput: comparison.example.revision.referenceOutput,
          repeatedRunGroupsByExperimentId,
        };
      }),
    [data]
  );

  const exampleIds = useMemo(() => {
    return tableData.map((row) => row.id);
  }, [tableData]);

  // Calculate the max annotation count across all repeated run groups for consistent row heights
  const maxAnnotationCount = useMemo(() => {
    let max = 0;
    for (const row of tableData) {
      for (const group of Object.values(row.repeatedRunGroupsByExperimentId)) {
        const count = group.annotationSummaries.length;
        if (count > max) max = count;
      }
    }
    return max;
  }, [tableData]);

  // Calculate cell content height to account for annotation list
  const cellContentHeight =
    CELL_PRIMARY_CONTENT_HEIGHT +
    calculateAnnotationListHeight(maxAnnotationCount);

  const baseColumns: ColumnDef<TableRow>[] = useMemo(() => {
    return [
      {
        header: "input",
        accessorKey: "input",
        enableSorting: false,
        cell: ({ row }) => (
          <ExperimentInputCell
            exampleId={row.original.example.id}
            value={row.original.input}
            height={cellContentHeight}
            onExpand={() => {
              setDialog(
                <ExampleDetailsDialog
                  exampleId={row.original.example.id}
                  datasetVersionId={baseExperiment?.datasetVersionId}
                />
              );
            }}
          />
        ),
      },
      {
        header: () => (
          <Flex direction="column" gap="size-50" width="100%">
            <span>reference output</span>
            <ExperimentCostAndLatencySummary
              executionState="idle"
              isPlaceholder={true}
            />
            <ExperimentAnnotationAggregates
              executionState="idle"
              annotationConfigs={annotationConfigs}
              isPlaceholder={true}
            />
          </Flex>
        ),
        accessorKey: "referenceOutput",
        enableSorting: false,
        cell: ({ getValue }) => (
          <ExperimentReferenceOutputCell
            value={getValue()}
            height={cellContentHeight}
          />
        ),
      },
    ];
  }, [
    annotationConfigs,
    baseExperiment?.datasetVersionId,
    cellContentHeight,
    setDialog,
  ]);

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
            <Flex direction="column" gap="size-50">
              <Flex
                direction="row"
                gap="size-100"
                wrap
                justifyContent="space-between"
                alignItems="start"
              >
                <ExperimentNameWithColorSwatch
                  name={name}
                  color={experimentColor}
                />
                <div css={actionMenuContainerCSS}>
                  <ExperimentActionMenu
                    experimentId={experimentId}
                    metadata={metadata}
                    projectId={projectId}
                    size="S"
                    canDeleteExperiment={false}
                  />
                </div>
              </Flex>
              <div>
                {experiment && (
                  <ExperimentCostAndLatencySummary
                    executionState="complete"
                    experiment={experiment}
                  />
                )}
              </div>
              <ExperimentAnnotationAggregates
                executionState="complete"
                annotationConfigs={annotationConfigs}
                annotationSummaries={experiment?.annotationSummaries ?? []}
              />
            </Flex>
          );
        },
        accessorKey: experimentId,
        minSize: 500,
        enableSorting: false,
        cell: ({ row }) => {
          const repeatedRunGroup =
            row.original.repeatedRunGroupsByExperimentId[experimentId];
          // if a new experiment was just added, data may not be fully loaded yet
          if (repeatedRunGroup == null) {
            return null;
          }
          const annotationSummaries = repeatedRunGroup.annotationSummaries;

          return (
            <ExperimentRunOutputCell
              rowIndex={row.index}
              experimentRepetitionCount={
                experimentInfoById[experimentId]?.repetitions ?? 0
              }
              repeatedRunGroup={repeatedRunGroup}
              setDialog={setDialog}
              setSelectedExampleIndex={setSelectedExampleIndex}
              annotationSummaries={annotationSummaries}
              annotationConfigs={annotationConfigs}
              height={CELL_PRIMARY_CONTENT_HEIGHT}
            />
          );
        },
      })
    );
  }, [
    annotationConfigs,
    baseExperimentId,
    baseExperimentColor,
    compareExperimentIds,
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
          baseExperimentId,
          compareExperimentIds,
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
          <ExperimentRunFilterConditionField
            onValidCondition={setFilterCondition}
          />
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
                estimatedRowHeight={calculateEstimatedRowHeight(
                  maxAnnotationCount
                )}
              />
            ) : (
              <TableBody
                table={table}
                tableContainerRef={tableContainerRef}
                estimatedRowHeight={calculateEstimatedRowHeight(
                  maxAnnotationCount
                )}
              />
            )}
          </table>
        </div>
      </Flex>
      <ModalOverlay
        isOpen={selectedExampleIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedExampleIndex(null);
          }
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {selectedExampleIndex !== null &&
            exampleIds[selectedExampleIndex] &&
            baseExperiment && (
              <ExperimentCompareDetailsDialog
                datasetId={datasetId}
                datasetVersionId={baseExperiment.datasetVersionId}
                selectedExampleIndex={selectedExampleIndex}
                selectedExampleId={exampleIds[selectedExampleIndex]}
                baseExperimentId={baseExperimentId}
                compareExperimentIds={compareExperimentIds}
                exampleIds={exampleIds}
                onExampleChange={(exampleIndex) => {
                  if (
                    exampleIndex === exampleIds.length - 1 &&
                    !isLoadingNext &&
                    hasNext
                  ) {
                    loadNext(PAGE_SIZE);
                  }
                  if (exampleIndex >= 0 && exampleIndex < exampleIds.length) {
                    setSelectedExampleIndex(exampleIndex);
                  }
                }}
                openTraceDialog={(traceId, projectId, title) => {
                  setDialog(
                    <TraceDetailsDialog
                      traceId={traceId}
                      projectId={projectId}
                      title={title}
                    />
                  );
                }}
              />
            )}
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        isOpen={!!dialog}
        onOpenChange={() => {
          // Clear the URL search params for the span selection
          setSearchParams(
            (prev) => {
              const newParams = new URLSearchParams(prev);
              newParams.delete("selectedSpanNodeId");
              return newParams;
            },
            { replace: true }
          );
          setDialog(null);
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {dialog}
        </Modal>
      </ModalOverlay>
    </View>
  );
}

//un-memoized normal table body component - see memoized version below
function TableBody<T>({
  table,
  tableContainerRef,
  estimatedRowHeight,
}: {
  table: Table<T>;
  tableContainerRef: RefObject<HTMLDivElement | null>;
  estimatedRowHeight: number;
}) {
  "use no memo";
  const rows = table.getRowModel().rows;
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
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

/**
 * Display the output of an experiment run.
 * If the output is a chat message format with an assistant message,
 * it extracts and renders just the content as markdown.
 */
const outputContentCSS = css`
  flex: none;
  padding: var(--ac-global-dimension-size-200);
`;

function ExperimentRunOutput(
  props: ExperimentRun & {
    numRepetitions: number;
    setDialog: (dialog: ReactNode) => void;
    annotationSummaries: readonly AnnotationSummary[];
    annotationConfigs: readonly AnnotationConfig[];
    height: number;
  }
) {
  const { output, error, annotations, setDialog, height, annotationConfigs } =
    props;

  if (error) {
    return <RunError error={error} />;
  }
  const annotationsList = annotations?.edges.length
    ? annotations.edges.map((edge) => edge.annotation)
    : [];

  return (
    <Flex direction="column" height="100%" justifyContent="space-between">
      <OverflowCell height={height}>
        <div css={outputContentCSS}>
          <ExperimentOutputContent value={output} />
        </div>
      </OverflowCell>
      <ExperimentRunCellAnnotationsList
        annotations={annotationsList}
        annotationSummaries={props.annotationSummaries}
        annotationConfigs={annotationConfigs}
        numRepetitions={props.numRepetitions}
        onTraceClick={({ traceId, projectId, annotationName }) => {
          setDialog(
            <TraceDetailsDialog
              title={`Evaluator Trace: ${annotationName}`}
              traceId={traceId}
              projectId={projectId}
            />
          );
        }}
        renderFilters={true}
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

function ExperimentRunOutputCell({
  experimentRepetitionCount,
  repeatedRunGroup,
  setDialog,
  rowIndex,
  setSelectedExampleIndex,
  annotationSummaries,
  annotationConfigs,
  height,
}: {
  experimentRepetitionCount: number;
  repeatedRunGroup: ExperimentRepeatedRunGroup;
  setDialog: (dialog: ReactNode) => void;
  rowIndex: number;
  setSelectedExampleIndex: (index: number) => void;
  annotationSummaries: readonly AnnotationSummary[];
  annotationConfigs: readonly AnnotationConfig[];
  height: number;
}) {
  const [selectedRepetitionNumber, setSelectedRepetitionNumber] = useState(1);

  const runsByRepetitionNumber = useMemo(() => {
    const runsByRepetitionNumber = repeatedRunGroup.runs.reduce(
      (acc, run) => {
        acc[run.repetitionNumber] = run;
        return acc;
      },
      {} as Record<number, ExperimentRun>
    );
    return runsByRepetitionNumber;
  }, [repeatedRunGroup.runs]);

  if (repeatedRunGroup.runs.length === 0) {
    return (
      <PaddedCell>
        <Empty message="No Run" />
      </PaddedCell>
    );
  }

  const run: ExperimentRun | null =
    runsByRepetitionNumber[selectedRepetitionNumber];

  const traceId = run?.trace?.traceId;
  const projectId = run?.trace?.projectId;
  const hasTrace = traceId != null && projectId != null;
  const runControls = (
    <>
      {experimentRepetitionCount > 1 ? (
        <ExperimentRepetitionSelector
          repetitionNumber={selectedRepetitionNumber}
          totalRepetitions={experimentRepetitionCount}
          setRepetitionNumber={setSelectedRepetitionNumber}
        />
      ) : null}
      <TooltipTrigger>
        <IconButton
          className="expand-button"
          size="S"
          aria-label="View example run details"
          onPress={() => {
            setSelectedExampleIndex(rowIndex);
          }}
        >
          <Icon svg={<Icons.ExpandOutline />} />
        </IconButton>
        <Tooltip>
          <TooltipArrow />
          view experiment run
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger isDisabled={!hasTrace}>
        <IconButton
          className="trace-button"
          size="S"
          aria-label="View run trace"
          onPress={() => {
            setDialog(
              <TraceDetailsDialog
                traceId={traceId || ""}
                projectId={projectId || ""}
                title={`Experiment Run Trace`}
              />
            );
          }}
          isDisabled={!hasTrace}
        >
          <Icon svg={<Icons.Trace />} />
        </IconButton>
        <Tooltip>
          <TooltipArrow />
          view run trace
        </Tooltip>
      </TooltipTrigger>
    </>
  );

  return (
    <Flex direction="column" height="100%">
      <CellTop extra={runControls}>
        <ExperimentRepeatedRunGroupMetadata fragmentRef={repeatedRunGroup} />
      </CellTop>
      {run ? (
        <ExperimentRunOutput
          {...run}
          numRepetitions={experimentRepetitionCount}
          setDialog={setDialog}
          annotationSummaries={annotationSummaries}
          annotationConfigs={annotationConfigs}
          height={height}
        />
      ) : (
        <PaddedCell>
          <Empty message="Missing Repetition" />
        </PaddedCell>
      )}
    </Flex>
  );
}
