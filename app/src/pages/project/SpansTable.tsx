import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Content,
  ContextualHelp,
  Flex,
  Heading,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { Link } from "@phoenix/components/Link";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  SpansTable_spans$key,
  SpanStatusCode,
} from "./__generated__/SpansTable_spans.graphql";
import { SpansTableSpansQuery } from "./__generated__/SpansTableSpansQuery.graphql";
import { AnnotationTooltipFilterActions } from "./AnnotationTooltipFilterActions";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { SpanSelectionToolbar } from "./SpanSelectionToolbar";
import { spansTableCSS } from "./styles";
import {
  ANNOTATIONS_COLUMN_PREFIX,
  ANNOTATIONS_KEY_SEPARATOR,
  DEFAULT_SORT,
  getGqlSort,
} from "./tableUtils";
type SpansTableProps = {
  project: SpansTable_spans$key;
};

const PAGE_SIZE = 50;

export function SpansTable(props: SpansTableProps) {
  const { fetchKey } = useStreamState();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const navigate = useNavigate();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SpansTableSpansQuery, SpansTable_spans$key>(
      graphql`
        fragment SpansTable_spans on Project
        @refetchable(queryName: "SpansTableSpansQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 50 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          name
          ...SpanColumnSelector_annotations
          spans(
            first: $first
            after: $after
            sort: $sort
            filterCondition: $filterCondition
            timeRange: $timeRange
          ) @connection(key: "SpansTable_spans") {
            edges {
              span: node {
                id
                spanKind
                name
                metadata
                statusCode
                startTime
                latencyMs
                tokenCountTotal
                tokenCountPrompt
                tokenCountCompletion
                context {
                  spanId
                  traceId
                }
                input {
                  value: truncatedValue
                }
                output {
                  value: truncatedValue
                }
                spanAnnotations {
                  name
                  label
                  score
                  annotatorKind
                }
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
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

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => span);

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];

  const dynamicAnnotationColumns: ColumnDef<TableRow>[] =
    visibleAnnotationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `label`,
            accessorKey: `${ANNOTATIONS_COLUMN_PREFIX}${ANNOTATIONS_KEY_SEPARATOR}label${ANNOTATIONS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotations.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return annotation.label;
            },
          } as ColumnDef<TableRow>,
          {
            header: `score`,
            accessorKey: `${ANNOTATIONS_COLUMN_PREFIX}${ANNOTATIONS_KEY_SEPARATOR}score${ANNOTATIONS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotations.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return annotation.score;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const annotationColumns: ColumnDef<TableRow>[] = [
    {
      header: () => (
        <Flex direction="row" gap="size-50">
          <span>feedback</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Feedback
            </Heading>
            <Content>
              Feedback includes evaluations and human annotations logged via the
              API or set via the UI.
            </Content>
          </ContextualHelp>
        </Flex>
      ),
      accessorKey: "spanAnnotations",
      enableSorting: false,

      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            {row.original.spanAnnotations.map((annotation) => {
              return (
                <AnnotationTooltip
                  key={annotation.name}
                  annotation={annotation}
                  layout="horizontal"
                  width="500px"
                  extra={
                    <AnnotationTooltipFilterActions annotation={annotation} />
                  }
                >
                  <AnnotationLabel
                    annotation={annotation}
                    annotationDisplayPreference="label"
                  />
                </AnnotationTooltip>
              );
            })}
            {row.original.documentRetrievalMetrics.map((retrievalMetric) => {
              return (
                <>
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
                </>
              );
            })}
          </Flex>
        );
      },
    },
    ...dynamicAnnotationColumns,
  ];
  const columns: ColumnDef<TableRow>[] = [
    {
      id: "select",
      maxSize: 10,
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
      header: "kind",
      accessorKey: "spanKind",
      maxSize: 100,
      enableSorting: false,
      cell: ({ getValue }) => {
        return <SpanKindLabel spanKind={getValue() as string} />;
      },
    },
    {
      header: "name",
      accessorKey: "name",
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const span = row.original;
        const { traceId } = span.context;
        return (
          <Link to={`traces/${traceId}?selectedSpanNodeId=${span.id}`}>
            {getValue() as string}
          </Link>
        );
      },
    },
    {
      header: "input",
      accessorKey: "input.value",
      cell: TextCell,
      enableSorting: false,
    },
    {
      header: "output",
      accessorKey: "output.value",
      cell: TextCell,
      enableSorting: false,
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      cell: TextCell,
      enableSorting: false,
    },
    ...annotationColumns, // TODO: consider hiding this column if there are no evals. For now we want people to know that there are evals
    {
      header: "start time",
      accessorKey: "startTime",
      cell: TimestampCell,
    },
    {
      header: "latency",
      accessorKey: "latencyMs",

      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return null;
        }
        return <LatencyText latencyMs={value} />;
      },
    },
    {
      header: "total tokens",
      accessorKey: "tokenCountTotal",
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null) {
          return "--";
        }
        return (
          <TokenCount
            tokenCountTotal={value as number}
            tokenCountPrompt={row.original.tokenCountPrompt || 0}
            tokenCountCompletion={row.original.tokenCountCompletion || 0}
          />
        );
      },
    },
    {
      header: "status",
      accessorKey: "statusCode",
      enableSorting: false,
      cell: ({ getValue }) => {
        return <SpanStatusCodeIcon statusCode={getValue() as SpanStatusCode} />;
      },
    },
  ];

  useEffect(() => {
    //if the sorting changes, we need to reset the pagination
    const sort = sorting[0];

    startTransition(() => {
      refetch(
        {
          sort: sort ? getGqlSort(sort) : DEFAULT_SORT,
          after: null,
          first: PAGE_SIZE,
          filterCondition,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [sorting, refetch, filterCondition, fetchKey]);
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
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    manualSorting: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedSpans = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  const isEmpty = rows.length === 0;
  const computedColumns = table.getAllColumns().filter((column) => {
    // Filter out columns that are eval groupings
    return column.columns.length === 0;
  });

  return (
    <div css={spansTableCSS}>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="grey-300"
        borderBottomWidth="thin"
        flex="none"
      >
        <Flex direction="row" gap="size-100" width="100%" alignItems="center">
          <SpanFilterConditionField onValidCondition={setFilterCondition} />
          <SpanColumnSelector columns={computedColumns} query={data} />
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
        <table css={selectableTableCSS}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th colSpan={header.colSpan} key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? "cursor-pointer"
                            : "",
                          onClick: header.column.getToggleSortingHandler(),
                          style: {
                            left: header.getStart(),
                            width: header.getSize(),
                          },
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {isEmpty ? (
            <ProjectTableEmpty projectName={data.name} />
          ) : (
            <tbody>
              {rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      navigate(
                        `traces/${row.original.context.traceId}?selectedSpanNodeId=${row.original.id}`
                      )
                    }
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
                );
              })}
            </tbody>
          )}
        </table>
      </div>
      {selectedRows.length ? (
        <SpanSelectionToolbar
          selectedSpans={selectedSpans}
          onClearSelection={clearSelection}
        />
      ) : null}
    </div>
  );
}
