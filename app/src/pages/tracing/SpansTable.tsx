import React, {
  startTransition,
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

import { Flex, Icon, Icons, View } from "@arizeai/components";

import { Link } from "@phoenix/components/Link";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  SpansTable_spans$key,
  SpanStatusCode,
} from "./__generated__/SpansTable_spans.graphql";
import { SpansTableSpansQuery } from "./__generated__/SpansTableSpansQuery.graphql";
import { EvaluationLabel } from "./EvaluationLabel";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { spansTableCSS } from "./styles";
import {
  DEFAULT_SORT,
  EVALS_COLUMN_PREFIX,
  EVALS_KEY_SEPARATOR,
  getGqlSort,
} from "./tableUtils";
import { TokenCount } from "./TokenCount";
type SpansTableProps = {
  query: SpansTable_spans$key;
};

const PAGE_SIZE = 100;

export function SpansTable(props: SpansTableProps) {
  const { fetchKey } = useStreamState();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const navigate = useNavigate();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SpansTableSpansQuery, SpansTable_spans$key>(
      graphql`
        fragment SpansTable_spans on Query
        @refetchable(queryName: "SpansTableSpansQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          ...SpanColumnSelector_evaluations
          spans(
            first: $first
            after: $after
            sort: $sort
            filterCondition: $filterCondition
          ) @connection(key: "SpansTable_spans") {
            edges {
              span: node {
                spanKind
                name
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
                  value
                  mimeType
                }
                output {
                  value
                  mimeType
                }
                spanEvaluations {
                  name
                  label
                  score
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
      props.query
    );

  const evaluationVisibility = useTracingContext(
    (state) => state.evaluationVisibility
  );
  const visibleEvaluationColumnNames = useMemo(() => {
    return Object.keys(evaluationVisibility).filter(
      (name) => evaluationVisibility[name]
    );
  }, [evaluationVisibility]);

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => span);

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];

  const dynamicEvaluationColumns: ColumnDef<TableRow>[] =
    visibleEvaluationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `label`,
            accessorKey: `${EVALS_COLUMN_PREFIX}${EVALS_KEY_SEPARATOR}label${EVALS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const evaluation = row.original.spanEvaluations.find(
                (evaluation) => evaluation.name === name
              );
              if (!evaluation) {
                return null;
              }
              return evaluation.label;
            },
          } as ColumnDef<TableRow>,
          {
            header: `score`,
            accessorKey: `${EVALS_COLUMN_PREFIX}${EVALS_KEY_SEPARATOR}score${EVALS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const evaluation = row.original.spanEvaluations.find(
                (evaluation) => evaluation.name === name
              );
              if (!evaluation) {
                return null;
              }
              return evaluation.score;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const evaluationColumns: ColumnDef<TableRow>[] = [
    {
      header: "evaluations",
      accessorKey: "spanEvaluations",
      enableSorting: false,

      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            {row.original.spanEvaluations.map((evaluation) => {
              return (
                <EvaluationLabel
                  key={evaluation.name}
                  evaluation={evaluation}
                />
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
    ...dynamicEvaluationColumns,
  ];
  const columns: ColumnDef<TableRow>[] = [
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
        const { spanId, traceId } = row.original.context;
        return (
          <Link to={`/tracing/traces/${traceId}?selectedSpanId=${spanId}`}>
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
    ...evaluationColumns, // TODO: consider hiding this column if there are no evals. For now we want people to know that there are evals
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
  const fetchMoreOnBottomReached = React.useCallback(
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
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
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
            <TableEmpty />
          ) : (
            <tbody>
              {rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      navigate(
                        `traces/${row.original.context.traceId}?selectedSpanId=${row.original.context.spanId}`
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
    </div>
  );
}
