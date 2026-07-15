import { css } from "@emotion/react";
import type {
  CellContext,
  ColumnDef,
  ExpandedState,
  SortingState,
  Table,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
/* eslint-disable react/prop-types */
import type { ComponentProps } from "react";
import React, {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams, useSearchParams } from "react-router";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  Link,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { TraceAnnotationSummaryGroupTokens } from "@phoenix/components/annotation/TraceAnnotationSummaryGroup";
import { ContextualHelp } from "@phoenix/components/core/tooltip/ContextualHelp";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  ColumnHeaderCell,
  ColumnOrderingProvider,
  CopyableTextCell,
  createRowSelectionColumn,
  useColumnOrder,
} from "@phoenix/components/table";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableExpandButton } from "@phoenix/components/table/TableExpandButton";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useShiftClickRowSelection } from "@phoenix/components/table/useShiftClickRowSelection";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TraceTokenCosts } from "@phoenix/components/trace/TraceTokenCosts";
import { TraceTokenCount } from "@phoenix/components/trace/TraceTokenCount";
import type { ISpanItem } from "@phoenix/components/trace/types";
import type { SpanTreeNode } from "@phoenix/components/trace/utils";
import { createSpanTree } from "@phoenix/components/trace/utils";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { SummaryValueLabels } from "@phoenix/pages/project/AnnotationSummary";
import { MetadataTableCell } from "@phoenix/pages/project/MetadataTableCell";
import { useTracePagination } from "@phoenix/pages/trace/TracePaginationContext";
import { getTraceDetailsPath } from "@phoenix/utils/urlUtils";

import type {
  SpanStatusCode,
  TracesTable_spans$data,
  TracesTable_spans$key,
} from "./__generated__/TracesTable_spans.graphql";
import type { TracesTableQuery } from "./__generated__/TracesTableQuery.graphql";
import { DEFAULT_PAGE_SIZE } from "./constants";
import {
  SpanInputValueTooltipCell,
  SpanOutputValueTooltipCell,
} from "./IOValueTooltipCell";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { SpanSelectionToolbar } from "./SpanSelectionToolbar";
import { spansTableCSS } from "./styles";
import { TableMetricsChartsPanelGroup } from "./TableMetricsCharts";
import { TableMetricsChartSelector } from "./TableMetricsChartSelector";
import {
  DEFAULT_SORT,
  getGqlSort,
  makeAnnotationColumnId,
  TRACE_ANNOTATIONS_COLUMN_ID,
} from "./tableUtils";

type TracesTableProps = {
  project: TracesTable_spans$key;
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const NUM_DESCENDANTS = 50;

interface IAdditionalSpansIndicator {
  /**
   * A flag that if set, indicates that this row is just there to show that there are N more spans under this span
   */
  __additionalRow?: true;
}
/**
 * An indicator that this row is an additional row, not a span
 */
interface IAdditionalSpansRow extends ISpanItem, IAdditionalSpansIndicator {}

/**
 * A nested table row is a span with a children that recursively
 * contains more nested table rows.
 */
type NestedSpanTableRow<TSpan extends IAdditionalSpansRow> = TSpan & {
  children: NestedSpanTableRow<TSpan>[];
};

const TableBody = <
  T extends TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"] &
    IAdditionalSpansRow,
>({
  table,
}: {
  table: Table<T>;
}) => {
  "use no memo";
  const navigate = useNavigate();
  const { traceId } = useParams();
  const [searchParams] = useSearchParams();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        const isSelected = row.original.trace.traceId === traceId;
        return (
          <tr
            key={row.id}
            onClick={() =>
              navigate(
                getTraceDetailsPath({
                  traceId: row.original.trace.traceId,
                  searchParams,
                })
              )
            }
            data-is-additional-row={row.original.__additionalRow}
            data-selected={isSelected}
            css={css(trCSS)}
          >
            {row.getVisibleCells().map((cell) => {
              const colSizeVar = `--col-${cell.column.id}-size`;
              return (
                <td
                  key={cell.id}
                  style={{
                    ...getCommonPinningStyles(cell.column),
                    width: `calc(var(${colSizeVar}) * 1px)`,
                    maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                    // prevent all wrapping, just show an ellipsis and let users expand if necessary
                    textWrap: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    userSelect:
                      cell.column.id === CHECKBOX_COLUMN_ID
                        ? "none"
                        : undefined,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
};

// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

const MetadataCell = <TData extends ISpanItem, TValue>({
  row,
}: CellContext<TData, TValue>) => {
  if (row.original.__additionalRow) {
    return null;
  }
  return <MetadataTableCell metadata={row.original.metadata} />;
};

const trCSS = css`
  &[data-is-additional-row="true"] {
    box-shadow: inset 0 -10px 20px var(--global-color-gray-100);
  }
`;

/**
 * Recursively create a nested table rows to display the span tree
 * as a table.
 */
function spanTreeToNestedSpanTableRows<TSpan extends ISpanItem>(params: {
  children: SpanTreeNode<TSpan>[];
}): NestedSpanTableRow<TSpan>[] {
  const { children } = params;
  const normalizedSpanTreeChildren: NestedSpanTableRow<TSpan>[] = [];
  for (const child of children) {
    const normalizedChild = {
      ...child.span,
      children: spanTreeToNestedSpanTableRows({
        children: child.children,
      }),
    };
    normalizedSpanTreeChildren.push(normalizedChild);
  }
  return normalizedSpanTreeChildren;
}

export function TracesTable(props: TracesTableProps) {
  const [searchParams] = useSearchParams();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const { fetchKey } = useStreamState();
  // Source the time range directly here (rather than only via the preloaded
  // parent query) so a live window sliding forward refetches with the filter
  // still applied. The parent query is intentionally not reloaded on window
  // slides — see the load effect in `ProjectPage` and issue #14216.
  const { timeRangeISOStrings } = useTimeRange();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<TracesTableQuery, TracesTable_spans$key>(
      graphql`
        fragment TracesTable_spans on Project
        @refetchable(queryName: "TracesTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 30 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
          numDescendants: { type: "Int", defaultValue: 50 }
        ) {
          name
          ...SpanColumnSelector_annotations
          ...SpanColumnSelector_traceAnnotations
          rootSpans: spans(
            first: $first
            after: $after
            sort: $sort
            rootSpansOnly: true
            filterCondition: $filterCondition
            timeRange: $timeRange
          ) @connection(key: "TracesTable_rootSpans") {
            edges {
              rootSpan: node {
                id
                spanKind
                name
                metadata
                statusCode
                statusMessage
                startTime
                endTime
                latencyMs
                cumulativeTokenCountTotal
                parentId
                input {
                  value: truncatedValue
                }
                output {
                  value: truncatedValue
                }
                spanId
                trace {
                  id
                  traceId
                  userId
                  numSpans
                  costSummary {
                    total {
                      cost
                    }
                  }
                  traceAnnotationSummaries {
                    labelFractions {
                      fraction
                      label
                    }
                    meanScore
                    name
                  }
                  ...TraceAnnotationSummaryGroup
                }
                spanAnnotations {
                  id
                  name
                  label
                  score
                  annotatorKind
                  createdAt
                }
                spanAnnotationSummaries {
                  labelFractions {
                    fraction
                    label
                  }
                  meanScore
                  name
                }
                ...AnnotationSummaryGroup
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
                }
                descendants(first: $numDescendants) {
                  edges {
                    node {
                      id
                      spanKind
                      name
                      statusCode: propagatedStatusCode
                      statusMessage
                      startTime
                      endTime
                      latencyMs
                      parentId
                      cumulativeTokenCountTotal: tokenCountTotal
                      input {
                        value: truncatedValue
                      }
                      output {
                        value: truncatedValue
                      }
                      spanId
                      trace {
                        id
                        traceId
                      }
                      spanAnnotations {
                        id
                        name
                        label
                        score
                        annotatorKind
                        createdAt
                      }
                      ...AnnotationSummaryGroup
                      documentRetrievalMetrics {
                        evaluationName
                        ndcg
                        precision
                        hit
                      }
                      ...TraceHeaderRootSpanAnnotationsFragment
                    }
                  }
                }
              }
            }
          }
        }
      `,
      props.project
    );

  const annotationColumnVisibility = useTracingContext(
    (state) => state.annotationColumnVisibility
  );
  const visibleAnnotationColumnNames = useMemo(() => {
    return Object.keys(annotationColumnVisibility).filter(
      (name) => annotationColumnVisibility[name]
    );
  }, [annotationColumnVisibility]);
  const traceAnnotationColumnVisibility = useTracingContext(
    (state) => state.traceAnnotationColumnVisibility
  );
  const visibleTraceAnnotationColumnNames = useMemo(() => {
    return Object.keys(traceAnnotationColumnVisibility).filter(
      (name) => traceAnnotationColumnVisibility[name]
    );
  }, [traceAnnotationColumnVisibility]);
  const tableData = useMemo(() => {
    return data.rootSpans.edges.map(({ rootSpan }) => {
      // Construct the set of spans over which you want to construct the tree
      const spanTree = createSpanTree([
        rootSpan,
        ...rootSpan.descendants.edges.map(({ node }) => node),
      ]);
      // Unwrap the root span from the span tree and return it
      const [root] = spanTreeToNestedSpanTableRows({
        children: spanTree,
      });
      type SpanRowType = typeof root & IAdditionalSpansRow;
      // check if there are more spans in the tree than is loaded
      const numSpansNotLoaded = rootSpan.trace.numSpans - NUM_DESCENDANTS - 1;
      if (numSpansNotLoaded > 0) {
        root.children = [
          ...root.children,
          // We add a dummy span here to indicate that there are more spans in the tree
          {
            ...root,
            // Indicate that this is an additional row, not a span
            __additionalRow: true,
            name: `+ ${numSpansNotLoaded} more span${
              numSpansNotLoaded > 1 ? "s" : ""
            }`,
            id: `additional-${root.id}`,
            // Clear out the span info
            input: { value: "" },
            output: { value: "" },
            metadata: null,
            spanAnnotations: [],
            documentRetrievalMetrics: [],
            children: [],
          } as SpanRowType,
        ];
      }
      return root as SpanRowType;
    });
  }, [data]);
  type TableRow = (typeof tableData)[number];
  const { selectRow } = useShiftClickRowSelection<TableRow>({
    resetKey: tableData,
  });

  const dynamicAnnotationColumns: ColumnDef<TableRow>[] = useMemo(
    () =>
      visibleAnnotationColumnNames.map((name) => {
        return {
          header: name,
          columns: [
            {
              header: `labels`,
              accessorKey: makeAnnotationColumnId(name, "label"),
              cell: ({ row }) => {
                const annotation = (
                  row.original
                    .spanAnnotationSummaries as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["spanAnnotationSummaries"]
                )?.find((annotation) => annotation.name === name);
                if (!annotation) {
                  return null;
                }
                return (
                  <SummaryValueLabels
                    name={name}
                    labelFractions={annotation.labelFractions}
                  />
                );
              },
            } as ColumnDef<TableRow>,
            {
              header: `mean score`,
              accessorKey: makeAnnotationColumnId(name, "score"),
              cell: ({ row }) => {
                const annotation = (
                  row.original
                    .spanAnnotationSummaries as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["spanAnnotationSummaries"]
                )?.find((annotation) => annotation.name === name);
                if (!annotation) {
                  return null;
                }
                return (
                  <MeanScore value={annotation.meanScore} fallback={null} />
                );
              },
            } as ColumnDef<TableRow>,
          ],
        };
      }),
    [visibleAnnotationColumnNames]
  );

  const dynamicTraceAnnotationColumns: ColumnDef<TableRow>[] = useMemo(
    () =>
      visibleTraceAnnotationColumnNames.map((name) => {
        return {
          header: name,
          columns: [
            {
              header: `labels`,
              accessorKey: makeAnnotationColumnId(name, "label", "trace"),
              enableSorting: false,
              cell: ({ row }) => {
                if (row.depth !== 0 || row.original.__additionalRow) {
                  return null;
                }
                const annotation = (
                  row.original
                    .trace as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["trace"]
                )?.traceAnnotationSummaries?.find(
                  (annotation) => annotation.name === name
                );
                if (!annotation) {
                  return null;
                }
                return (
                  <SummaryValueLabels
                    name={name}
                    labelFractions={annotation.labelFractions}
                  />
                );
              },
            } as ColumnDef<TableRow>,
            {
              header: `mean score`,
              accessorKey: makeAnnotationColumnId(name, "score", "trace"),
              enableSorting: false,
              cell: ({ row }) => {
                if (row.depth !== 0 || row.original.__additionalRow) {
                  return null;
                }
                const annotation = (
                  row.original
                    .trace as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["trace"]
                )?.traceAnnotationSummaries?.find(
                  (annotation) => annotation.name === name
                );
                if (!annotation) {
                  return null;
                }
                return (
                  <MeanScore value={annotation.meanScore} fallback={null} />
                );
              },
            } as ColumnDef<TableRow>,
          ],
        };
      }),
    [visibleTraceAnnotationColumnNames]
  );

  const annotationColumns: ColumnDef<TableRow>[] = useMemo(
    () => [
      {
        header: () => (
          <Flex direction="row" gap="size-50" alignItems="center">
            <span>Annotations</span>
            <ContextualHelp>
              <Heading level={3} weight="heavy">
                Annotations
              </Heading>
              <Text>
                Evaluations and human annotations logged via the API or set via
                the UI.
              </Text>
            </ContextualHelp>
          </Flex>
        ),
        id: "annotations",
        accessorKey: "spanAnnotations",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const hasNoFeedback =
            row.original.spanAnnotations.length === 0 &&
            row.original.documentRetrievalMetrics.length === 0;
          return (
            <Flex direction="row" gap="size-50" wrap="wrap">
              <AnnotationSummaryGroupTokens
                span={row.original}
                showFilterActions
              />
              {row.original.documentRetrievalMetrics.map((retrievalMetric) => {
                return (
                  <Fragment key="doc-evals">
                    <RetrievalEvaluationLabel
                      key="ndcg"
                      name={retrievalMetric.evaluationName}
                      metric="ndcg"
                      score={retrievalMetric.ndcg}
                    />
                    <RetrievalEvaluationLabel
                      key="precision"
                      name={retrievalMetric.evaluationName}
                      metric="precision"
                      score={retrievalMetric.precision}
                    />
                    <RetrievalEvaluationLabel
                      key="hit"
                      name={retrievalMetric.evaluationName}
                      metric="hit"
                      score={retrievalMetric.hit}
                    />
                  </Fragment>
                );
              })}
              {hasNoFeedback ? "--" : null}
            </Flex>
          );
        },
      },
      {
        header: () => (
          <Flex direction="row" gap="size-50" alignItems="center">
            <span>Trace annotations</span>
            <ContextualHelp>
              <Heading level={3} weight="heavy">
                Trace annotations
              </Heading>
              <Text>
                Annotations attached to the parent trace of this span.
              </Text>
            </ContextualHelp>
          </Flex>
        ),
        id: TRACE_ANNOTATIONS_COLUMN_ID,
        enableSorting: false,
        cell: ({ row }) => {
          if (row.depth !== 0 || row.original.__additionalRow) {
            return null;
          }
          return (
            <Flex direction="row" gap="size-50" wrap="wrap">
              <TraceAnnotationSummaryGroupTokens
                trace={
                  row.original.trace as Parameters<
                    typeof TraceAnnotationSummaryGroupTokens
                  >[0]["trace"]
                }
              />
            </Flex>
          );
        },
      },
      ...dynamicAnnotationColumns,
      ...dynamicTraceAnnotationColumns,
    ],
    [dynamicAnnotationColumns, dynamicTraceAnnotationColumns]
  );

  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
      createRowSelectionColumn<TableRow>({
        selectRow,
        shouldRenderCell: (row) => !row.original.__additionalRow,
        size: 24,
        minSize: 24,
        maxSize: 24,
      }),
      {
        header: "status",
        accessorKey: "statusCode",
        enableSorting: false,
        minSize: 50,
        maxSize: 50,
        cell: ({ getValue, row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const statusCode = getValue() as SpanStatusCode;
          return <SpanStatusCodeIcon statusCode={statusCode} />;
        },
      },
      {
        header: ({ table }) => {
          return (
            <Flex gap="size-50" direction="row" alignItems="center">
              <TableExpandButton
                isExpanded={table.getIsAllRowsExpanded()}
                onClick={table.getToggleAllRowsExpandedHandler()}
                aria-label="Expand all rows"
              />
              kind
            </Flex>
          );
        },
        enableSorting: false,
        accessorKey: "spanKind",
        size: 100,
        cell: (props) => {
          if (props.row.original.__additionalRow) {
            return (
              <div
                css={css`
                  // Since rows are flattened by default,
                  // we can use the row.depth property
                  // and paddingLeft to visually indicate the depth
                  // of the row
                  padding-left: ${props.row.depth * 2}rem;
                `}
              >
                <Icon svg={<Icons.MoreHorizontal />} />
              </div>
            );
          }

          return (
            <div
              css={css`
                // Since rows are flattened by default,
                // we can use the row.depth property
                // and paddingLeft to visually indicate the depth
                // of the row
                padding-left: ${props.row.depth * 2}rem;
              `}
            >
              <Flex gap="size-50">
                {props.row.getCanExpand() ? (
                  <TableExpandButton
                    isExpanded={props.row.getIsExpanded()}
                    onClick={props.row.getToggleExpandedHandler()}
                    aria-label="Expand row"
                  />
                ) : null}
                <SpanKindToken spanKind={props.getValue() as string} />
              </Flex>
            </div>
          );
        },
      },
      {
        header: "name",
        accessorKey: "name",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          const { traceId } = row.original.trace;
          const spanId = row.original.__additionalRow ? null : row.original.id;
          return (
            <Link
              to={getTraceDetailsPath({
                traceId,
                spanNodeId: spanId,
                searchParams,
              })}
            >
              {getValue() as string}
            </Link>
          );
        },
      },
      {
        header: "span id",
        accessorKey: "spanId",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          if (row.original.__additionalRow) return null;
          return <CopyableTextCell value={getValue() as string | null} />;
        },
      },
      {
        header: "trace id",
        accessorKey: "trace.traceId",
        id: "traceId",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          if (row.original.__additionalRow) return null;
          return <CopyableTextCell value={getValue() as string | null} />;
        },
      },
      {
        header: "input",
        accessorKey: "input.value",
        enableSorting: false,
        cell: ({ getValue, row }) => (
          <SpanInputValueTooltipCell
            nodeId={row.original.id}
            preview={getValue()}
          />
        ),
      },
      {
        header: "output",
        accessorKey: "output.value",
        enableSorting: false,
        cell: ({ getValue, row }) => (
          <SpanOutputValueTooltipCell
            nodeId={row.original.id}
            preview={getValue()}
          />
        ),
      },
      {
        header: () => (
          <Flex direction="row" gap="size-50" alignItems="center">
            <span>error</span>
            <ContextualHelp>
              <Heading level={3} weight="heavy">
                Error
              </Heading>
              <Text>
                The status message recorded on the span when its status code is
                ERROR, e.g. an exception message.
              </Text>
            </ContextualHelp>
          </Flex>
        ),
        accessorKey: "statusMessage",
        id: "error",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const value = getValue() as string;
          if (!value) {
            return "--";
          }
          return <Text color="danger">{value}</Text>;
        },
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        enableSorting: false,
        cell: MetadataCell,
      },
      {
        header: "user",
        accessorKey: "trace.userId",
        id: "userId",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          if (row.depth !== 0 || row.original.__additionalRow) return null;
          return <CopyableTextCell value={getValue() as string | null} />;
        },
      },
      ...annotationColumns, // TODO: consider hiding this column is there is no evals. For now show it
      {
        header: "start time",
        accessorKey: "startTime",
        cell: (props) => {
          if (props.row.original.__additionalRow) {
            return null;
          }
          return <TimestampCell {...props} />;
        },
      },
      {
        header: "latency",
        accessorKey: "latencyMs",
        cell: ({ getValue, row }) => {
          const value = getValue();
          if (
            value === null ||
            typeof value !== "number" ||
            row.original.__additionalRow
          ) {
            return null;
          }
          return <LatencyText latencyMs={value} />;
        },
      },
      {
        header: "total tokens",
        minSize: 80,
        accessorKey: "cumulativeTokenCountTotal",
        cell: ({ row, getValue }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const value = getValue();
          if (value === null) {
            return "--";
          }
          return (
            <TraceTokenCount
              tokenCountTotal={value as number}
              nodeId={row.original.trace.id}
            />
          );
        },
      },
      {
        header: "total cost",
        minSize: 80,
        accessorKey: "trace.costSummary.total.cost",
        id: "cumulativeTokenCostTotal",
        cell: ({ row, getValue }) => {
          const value = getValue();
          if (value === null || typeof value !== "number") {
            return "--";
          }
          const span = row.original;
          return (
            <TraceTokenCosts
              totalCost={value}
              nodeId={span.trace.id}
              size="S"
            />
          );
        },
      },
    ],
    [annotationColumns, searchParams, selectRow]
  );

  useEffect(() => {
    if (isFirstRender.current === true) {
      // Skip the first render. The data is already fetched by the parent
      isFirstRender.current = false;
      return;
    }
    //if the sorting changes, we need to reset the pagination
    const sort = sorting[0];
    startTransition(() => {
      refetch(
        {
          sort: sort ? getGqlSort(sort) : DEFAULT_SORT,
          after: null,
          first: PAGE_SIZE,
          filterCondition: filterCondition,
          numDescendants: NUM_DESCENDANTS,
          timeRange: timeRangeISOStrings,
        },
        {
          fetchPolicy: "store-and-network",
        }
      );
    });
  }, [sorting, refetch, filterCondition, fetchKey, timeRangeISOStrings]);

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

  const pagination = useTracePagination();
  const setTraceSequence = pagination?.setTraceSequence;
  useEffect(() => {
    if (!setTraceSequence) {
      return;
    }
    setTraceSequence(
      data.rootSpans.edges.map(({ rootSpan }) => ({
        traceId: rootSpan.trace.traceId,
        spanId: rootSpan.id,
      }))
    );
    return () => {
      setTraceSequence([]);
    };
  }, [data.rootSpans.edges, setTraceSequence]);

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnSizing = useTracingContext((state) => state.setColumnSizing);
  const columnSizing = useTracingContext((state) => state.columnSizing);
  const storedColumnOrder = useTracingContext((state) => state.columnOrder);
  const setStoredColumnOrder = useTracingContext(
    (state) => state.setColumnOrder
  );
  const {
    leafColumnOrder,
    visibleColumnOrder,
    onVisibleColumnOrderChange,
    getColumnOrderIndex,
  } = useColumnOrder({
    columns,
    columnOrder: storedColumnOrder,
    onColumnOrderChange: setStoredColumnOrder,
    columnVisibility,
    nonOrderableColumnIds: [CHECKBOX_COLUMN_ID],
  });
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    onExpandedChange: setExpanded,
    manualSorting: true,
    getSubRows: (row) => row.children,
    state: {
      sorting,
      expanded,
      columnVisibility,
      rowSelection,
      columnSizing,
      columnOrder: leafColumnOrder,
      columnPinning: CHECKBOX_COLUMN_PINNING,
    },
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) => !row.original.__additionalRow,
    enableSubRowSelection: false,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().flatRows;
  const selectedSpans = selectedRows.map((row) => ({
    id: row.original.id,
    traceId: row.original.trace.id,
  }));
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  const isEmpty = rows.length === 0;
  const computedColumns = table.getAllColumns().filter((column) => {
    // Filter out columns that are eval groupings
    return column.columns.length === 0;
  });
  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  const colLength = computedColumns.length;
  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = React.useMemo(() => {
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
  }, [getFlatHeaders, columnSizingInfo, columnSizingState, colLength]);

  return (
    <TableMetricsChartsPanelGroup view="traces">
      <div css={spansTableCSS}>
        <View
          paddingTop="size-100"
          paddingBottom="size-100"
          paddingStart="size-200"
          paddingEnd="size-200"
          borderBottomColor="default"
          borderBottomWidth="thin"
          flex="none"
        >
          <Flex direction="row" gap="size-100" width="100%" alignItems="center">
            <SpanFilterConditionField onValidCondition={setFilterCondition} />
            <TableMetricsChartSelector view="traces" />
            <SpanColumnSelector columns={table.getAllColumns()} query={data} />
          </Flex>
        </View>
        <div
          css={css`
            flex: 1 1 auto;
            overflow: auto;
          `}
          onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
          ref={tableContainerRef}
        >
          <ColumnOrderingProvider
            columnOrder={visibleColumnOrder}
            onColumnOrderChange={onVisibleColumnOrderChange}
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
                {table
                  .getHeaderGroups()
                  .map((headerGroup, headerGroupIndex) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <ColumnHeaderCell
                          key={header.id}
                          columnId={header.column.id}
                          // Only the top header group is reorderable; sub-headers
                          // of a group column move with it
                          index={
                            headerGroupIndex === 0
                              ? getColumnOrderIndex(header.column.id)
                              : -1
                          }
                          label={
                            typeof header.column.columnDef.header === "string"
                              ? header.column.columnDef.header
                              : undefined
                          }
                          style={{
                            ...getCommonPinningStyles(header.column),
                            width: `calc(var(--header-${header.id}-size) * 1px)`,
                          }}
                          colSpan={header.colSpan}
                        >
                          {header.isPlaceholder ? null : (
                            <>
                              <div
                                data-sortable={header.column.getCanSort()}
                                {...{
                                  className: header.column.getCanSort()
                                    ? "sort"
                                    : "",
                                  onClick:
                                    header.column.getToggleSortingHandler(),
                                  style: {
                                    left: header.getStart(),
                                    width: header.getSize(),
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
                                        <Icons.CaretUpFilled />
                                      ) : (
                                        <Icons.CaretDownFilled />
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
                        </ColumnHeaderCell>
                      ))}
                    </tr>
                  ))}
              </thead>
              {isEmpty ? (
                <ProjectTableEmpty />
              ) : columnSizingInfo.isResizingColumn ? (
                <MemoizedTableBody
                  table={
                    // We can't access the internal TableRowType in the TableBody component
                    // so we cast to unknown and then to the correct type
                    table as unknown as ComponentProps<
                      typeof TableBody
                    >["table"]
                  }
                />
              ) : (
                <TableBody
                  table={
                    // We can't access the internal TableRowType in the TableBody component
                    // so we cast to unknown and then to the correct type
                    table as unknown as ComponentProps<
                      typeof TableBody
                    >["table"]
                  }
                />
              )}
            </table>
          </ColumnOrderingProvider>
        </div>
        {selectedRows.length ? (
          <SpanSelectionToolbar
            selectedSpans={selectedSpans}
            onClearSelection={clearSelection}
          />
        ) : null}
      </div>
    </TableMetricsChartsPanelGroup>
  );
}
