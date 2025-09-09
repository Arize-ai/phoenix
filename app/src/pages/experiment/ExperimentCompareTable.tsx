import React, {
  ReactNode,
  RefObject,
  SetStateAction,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
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
  Dialog,
  DialogCloseButton,
  DialogTrigger,
  Empty,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  LinkButton,
  Loading,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  Separator,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { JSONText } from "@phoenix/components/code/JSONText";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import {
  ExperimentAverageRunTokenCosts,
  useExperimentColors,
} from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import { ExperimentAverageRunTokenCount } from "@phoenix/components/experiment/ExperimentAverageRunTokenCount";
import { CellTop, CompactJSONCell } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { ExampleDetailsDialog } from "@phoenix/pages/example/ExampleDetailsDialog";
import { ExperimentNameWithColorSwatch } from "@phoenix/pages/experiment/ExperimentNameWithColorSwatch";
import { ExperimentRunAnnotationFiltersList } from "@phoenix/pages/experiment/ExperimentRunAnnotationFiltersList";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import { TraceDetails } from "../trace";

import type {
  ExperimentCompareTable_comparisons$data,
  ExperimentCompareTable_comparisons$key,
} from "./__generated__/ExperimentCompareTable_comparisons.graphql";
import type { ExperimentCompareTableQuery } from "./__generated__/ExperimentCompareTableQuery.graphql";
import { ExperimentAnnotationButton } from "./ExperimentAnnotationButton";
import { ExperimentCompareDetails } from "./ExperimentCompareDetails";
import { ExperimentRunFilterConditionField } from "./ExperimentRunFilterConditionField";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

type ExampleCompareTableProps = {
  query: ExperimentCompareTable_comparisons$key;
  datasetId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
};

type Experiment = NonNullable<
  ExperimentCompareTable_comparisons$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

// TODO - do not do this. This is exported until the data can be fetched independently in the detail view
export type ExperimentInfoMap = Record<string, Experiment | null>;

// TODO - do not do this. This is exported until the data can be fetched independently in the detail view
export type TableRow =
  ExperimentCompareTable_comparisons$data["compareExperiments"]["edges"][number]["comparison"] & {
    id: string;
    input: unknown;
    referenceOutput: unknown;
    runComparisonMap: Record<
      string,
      ExperimentCompareTable_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]
    >;
  };

// TODO - switch to a fragment and don't export
type RunComparisonItem =
  ExperimentCompareTable_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number];
export type ExperimentRun = RunComparisonItem["runs"][number];
type ExperimentRunAnnotation =
  ExperimentRun["annotations"]["edges"][number]["annotation"];

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
                runComparisonItems {
                  ...ExperimentRunMetadata_runs
                  experimentId
                  runs {
                    id
                    repetitionNumber
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
                    repetitionCount
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
      data.compareExperiments.edges.map((edge) => {
        const comparison = edge.comparison;
        const runComparisonMap = comparison.runComparisonItems.reduce(
          (acc, item) => {
            acc[item.experimentId] = item;
            return acc;
          },
          {} as Record<
            string,
            ExperimentCompareTable_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]
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
                    json={row.original.input}
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
          return (
            <ExperimentRunOutputCell
              datasetId={datasetId}
              experimentRepetitionCount={
                experimentInfoById[experimentId]?.repetitionCount ?? 0
              }
              runComparisonItem={row.original.runComparisonMap[experimentId]}
              displayFullText={displayFullText}
              setDialog={setDialog}
              experimentInfoById={experimentInfoById}
              tableRow={row.original}
            />
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
      <TooltipTrigger>
        <TriggerWrap>
          <Text size="S" fontFamily="mono" color="grey-500">
            AVG
          </Text>
        </TriggerWrap>
        <Tooltip>Averaged over runs in the experiment</Tooltip>
      </TooltipTrigger>
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

/**
 * Display the output of an experiment run.
 */
function ExperimentRunOutput(props: {
  runs: readonly ExperimentRun[];
  repetitionNumber: number;
  displayFullText: boolean;
  setDialog: (dialog: ReactNode) => void;
}) {
  const { runs, displayFullText, setDialog } = props;
  const run: ExperimentRun | null = runs[props.repetitionNumber];

  if (run == null) {
    return (
      <PaddedCell>
        <Empty message="Missing Repetition" />
      </PaddedCell>
    );
  }

  const { output, error, annotations } = run;
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
            <LinkButton
              size="S"
              to={`/datasets/${datasetId}/examples/${selectedExample.id}`}
            >
              View Example
            </LinkButton>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <ExperimentCompareDetails
          selectedExample={selectedExample}
          experimentInfoById={experimentInfoById}
        />
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
              <ExperimentAnnotationButton annotation={annotation} />
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

function ExperimentRunOutputCell({
  datasetId,
  experimentRepetitionCount,
  runComparisonItem,
  displayFullText,
  setDialog,
  experimentInfoById,
  tableRow,
}: {
  datasetId: string;
  experimentRepetitionCount: number;
  runComparisonItem: RunComparisonItem;
  displayFullText: boolean;
  setDialog: (dialog: ReactNode) => void;
  experimentInfoById: ExperimentInfoMap;
  tableRow: TableRow;
}) {
  const [repetitionNumber, setSelectedRepetitionNumber] = useState(1);

  const runsByRepetitionNumber = useMemo(() => {
    const runsByRepetitionNumber = runComparisonItem.runs.reduce(
      (acc, run) => {
        acc[run.repetitionNumber] = run;
        return acc;
      },
      {} as Record<number, ExperimentRun>
    );
    return runsByRepetitionNumber;
  }, [runComparisonItem.runs]);

  if (runComparisonItem.runs.length === 0) {
    return (
      <PaddedCell>
        <Empty message="No Run" />
      </PaddedCell>
    );
  }

  const run: ExperimentRun | null = runsByRepetitionNumber[repetitionNumber];

  let traceButton = null;
  const traceId = run?.trace?.traceId;
  const projectId = run?.trace?.projectId;
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
  const runDetailControls = (
    <TooltipTrigger>
      <IconButton
        className="expand-button"
        size="S"
        aria-label="View example run details"
        onPress={() => {
          setDialog(
            <SelectedExampleDialog
              selectedExample={tableRow}
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
  );

  return (
    <Flex direction="column" height="100%">
      <CellTop extra={runDetailControls}>
        <ExperimentRunMetadata
          fragmentKey={runComparisonItem}
          repetitionNumber={repetitionNumber}
        />
      </CellTop>
      <Flex
        alignItems="center"
        justifyContent="space-between"
        css={css`
          padding: var(--ac-global-dimension-static-size-100)
            var(--ac-global-dimension-static-size-100) 0
            var(--ac-global-dimension-static-size-200);
        `}
      >
        <ExperimentRepetitionSelector
          repetitionNumber={repetitionNumber}
          totalRepetitions={experimentRepetitionCount}
          setRepetitionNumber={setSelectedRepetitionNumber}
        />
        {traceButton}
      </Flex>
      <ExperimentRunOutput
        runs={runComparisonItem.runs}
        repetitionNumber={repetitionNumber}
        displayFullText={displayFullText}
        setDialog={setDialog}
      />
    </Flex>
  );
}

function ExperimentRepetitionSelector({
  repetitionNumber,
  totalRepetitions,
  setRepetitionNumber,
}: {
  repetitionNumber: number;
  totalRepetitions: number;
  setRepetitionNumber: (n: SetStateAction<number>) => void;
}) {
  return (
    <Flex direction="row" alignItems="center">
      <TooltipTrigger>
        <TriggerWrap>
          <Flex direction="row" alignItems="center">
            <Icon svg={<Icons.RepeatOutline />} />
            <Text
              css={css`
                margin-inline-start: var(--ac-global-dimension-size-100);
                margin-inline-end: var(--ac-global-dimension-size-100);
              `}
            >
              {`${repetitionNumber} / ${totalRepetitions}`}
            </Text>
          </Flex>
        </TriggerWrap>
        <Tooltip>
          {`repetition ${repetitionNumber} of ${totalRepetitions}`}
        </Tooltip>
      </TooltipTrigger>
      <IconButton
        size="S"
        isDisabled={repetitionNumber === 1}
        onPress={() => setRepetitionNumber((prev) => prev - 1)}
        aria-label="Previous repetition"
      >
        <Icon svg={<Icons.ChevronLeft />} />
      </IconButton>
      <IconButton
        size="S"
        isDisabled={repetitionNumber === totalRepetitions}
        onPress={() => setRepetitionNumber((prev) => prev + 1)}
        aria-label="Next repetition"
      >
        <Icon svg={<Icons.ChevronRight />} />
      </IconButton>
    </Flex>
  );
}
