import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { graphql, readInlineData } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  Updater,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, Token, View } from "@phoenix/components";
import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import type {
  DatasetEvaluatorFilter,
  DatasetEvaluatorSort,
} from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsTableEvaluatorsQuery.graphql";
import { DatasetEvaluatorActionMenu } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorActionMenu";
import type { DatasetEvaluatorsTable_row$key } from "@phoenix/pages/evaluators/__generated__/DatasetEvaluatorsTable_row.graphql";
import { useDatasetEvaluatorsFilterContext } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";
import { PromptCell } from "@phoenix/pages/evaluators/PromptCell";

export const convertEvaluatorSortToTanstackSort = (
  sort: DatasetEvaluatorSort | null | undefined
): SortingState => {
  if (!sort) return [];
  return [{ id: sort.col, desc: sort.dir === "desc" }];
};

const EVALUATOR_SORT_COLUMNS: DatasetEvaluatorSort["col"][] = [
  "display_name",
  "kind",
  "createdAt",
  "updatedAt",
];

export const convertTanstackSortToEvaluatorSort = (
  sorting: SortingState
): DatasetEvaluatorSort | null | undefined => {
  if (sorting.length === 0) return null;
  const col = sorting[0].id;
  if (
    EVALUATOR_SORT_COLUMNS.includes(
      col as (typeof EVALUATOR_SORT_COLUMNS)[number]
    )
  ) {
    return {
      col: col as DatasetEvaluatorSort["col"],
      dir: sorting[0].desc ? "desc" : "asc",
    };
  }
  // eslint-disable-next-line no-console
  console.error("Invalid sort column", col);
  return null;
};

const EmptyState = () => {
  return (
    <View width="100%" paddingY="size-400">
      <Flex
        direction="column"
        width="100%"
        alignItems="center"
        justifyContent="center"
      >
        <Text size="XL">
          Create and manage evaluators for your AI applications.
        </Text>
        {/* TODO: Put a video here explaining how to create and use evaluators */}
      </Flex>
    </View>
  );
};

const readRow = (row: DatasetEvaluatorsTable_row$key) => {
  return readInlineData(
    graphql`
      fragment DatasetEvaluatorsTable_row on DatasetEvaluator @inline {
        id
        displayName
        updatedAt
        evaluator {
          id
          name
          kind
          description
          createdAt
          updatedAt
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersionTag {
              name
            }
          }
        }
      }
    `,
    row
  );
};

export type TableRow = ReturnType<typeof readRow>;

type DatasetEvaluatorsTableProps = {
  /**
   * Relay fragment references for the evaluator rows to display in the table.
   *
   * To obtain row references, spread the EvaluatorsTable_row fragment into an Evaluators connection,
   * pass the resulting edges into this prop.
   */
  rowReferences: DatasetEvaluatorsTable_row$key[];
  emptyState?: React.ReactNode;
  isLoadingNext: boolean;
  hasNext: boolean;
  loadNext: (variables: {
    sort?: DatasetEvaluatorSort | null;
    filter?: DatasetEvaluatorFilter | null;
  }) => void;
  refetch: (variables: {
    sort?: DatasetEvaluatorSort | null;
    filter?: DatasetEvaluatorFilter | null;
  }) => void;
  onRowClick?: (row: TableRow) => void;
  /**
   * If datasetId is provided, the table will include an action menu with
   * the ability to unassign the evaluator from the dataset.
   */
  datasetId?: string;
  /**
   * If provided, these connections will be updated when a row is edited or deleted.
   */
  updateConnectionIds?: string[];
};

export const DatasetEvaluatorsTable = ({
  rowReferences,
  emptyState,
  isLoadingNext,
  hasNext,
  loadNext,
  refetch,
  onRowClick,
  datasetId,
  updateConnectionIds,
}: DatasetEvaluatorsTableProps) => {
  "use no memo";
  const { sort, setSort, filter } = useDatasetEvaluatorsFilterContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sorting = useMemo(
    () => convertEvaluatorSortToTanstackSort(sort),
    [sort]
  );
  const setSorting = useCallback(
    (sorting: Updater<SortingState>) => {
      if (typeof sorting === "function") {
        setSort((prevSort) =>
          convertTanstackSortToEvaluatorSort(
            sorting(convertEvaluatorSortToTanstackSort(prevSort))
          )
        );
      } else {
        setSort(convertTanstackSortToEvaluatorSort(sorting));
      }
    },
    [setSort]
  );
  const tableData = useMemo(() => {
    return rowReferences.map(readRow);
  }, [rowReferences]);
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "name",
        accessorKey: "displayName",
      },
      {
        header: "kind",
        accessorKey: "evaluator.kind",
        cell: ({ getValue }) => <Token>{getValue() as string}</Token>,
      },
      {
        header: "description",
        accessorKey: "evaluator.description",
        cell: TextCell,
        enableSorting: false,
      },
      {
        header: "prompt",
        accessorKey: "prompt",
        enableSorting: false,
        cell: ({ row }) => (
          <PromptCell
            prompt={row.original.evaluator.prompt}
            promptVersionTag={row.original.evaluator.promptVersionTag?.name}
          />
        ),
      },
      {
        header: "last updated",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
    ];
    if (datasetId) {
      cols.push({
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <DatasetEvaluatorActionMenu
            datasetEvaluatorId={row.original.id}
            evaluatorDisplayName={row.original.displayName}
            datasetId={datasetId}
            evaluatorKind={row.original.evaluator.kind}
            updateConnectionIds={updateConnectionIds}
          />
        ),
      });
    }
    return cols;
  }, [datasetId, updateConnectionIds]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
  });
  const fetchMoreOnBottomReached = (
    containerRefElement?: HTMLDivElement | null
  ) => {
    if (containerRefElement) {
      const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
      //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
      if (
        scrollHeight - scrollTop - clientHeight < 300 &&
        !isLoadingNext &&
        hasNext
      ) {
        loadNext({
          sort: sort,
          filter: filter ? { col: "display_name", value: filter } : null,
        });
      }
    }
  };
  // Refetch the data when the filter or sort changes
  useEffect(() => {
    startTransition(() => {
      refetch({
        sort: sort,
        filter: filter
          ? {
              col: "display_name",
              value: filter,
            }
          : null,
      });
    });
  }, [sort, filter, refetch]);

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return emptyState || <EmptyState />;
  }

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      ref={tableContainerRef}
    >
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort() ? "sort" : "",
                        ["aria-role"]: header.column.getCanSort()
                          ? "button"
                          : null,
                        onClick: header.column.getToggleSortingHandler(),
                        style: {
                          textAlign: header.column.columnDef.meta?.textAlign,
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
        <tbody>
          {rows.map((row) => {
            return (
              <tr
                key={row.id}
                onClick={() => {
                  onRowClick?.(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    align={cell.column.columnDef.meta?.textAlign}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
