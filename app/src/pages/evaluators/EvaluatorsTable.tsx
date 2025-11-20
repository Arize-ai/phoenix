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
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { EvaluatorsTable_row$key } from "@phoenix/pages/evaluators/__generated__/EvaluatorsTable_row.graphql";
import {
  EvaluatorFilter,
  EvaluatorSort,
} from "@phoenix/pages/evaluators/__generated__/GlobalEvaluatorsTableEvaluatorsQuery.graphql";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

export const convertEvaluatorSortToTanstackSort = (
  sort: EvaluatorSort | null | undefined
): SortingState => {
  if (!sort) return [];
  return [{ id: sort.col, desc: sort.dir === "desc" }];
};

const EVALUATOR_SORT_COLUMNS: EvaluatorSort["col"][] = [
  "name",
  "kind",
  "createdAt",
  "updatedAt",
];

export const convertTanstackSortToEvaluatorSort = (
  sorting: SortingState
): EvaluatorSort | null | undefined => {
  if (sorting.length === 0) return null;
  const col = sorting[0].id;
  if (
    EVALUATOR_SORT_COLUMNS.includes(
      col as (typeof EVALUATOR_SORT_COLUMNS)[number]
    )
  ) {
    return {
      col: col as EvaluatorSort["col"],
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

const readRow = (row: EvaluatorsTable_row$key) => {
  return readInlineData(
    graphql`
      fragment EvaluatorsTable_row on Evaluator
      @inline
      @argumentDefinitions(datasetId: { type: "ID", defaultValue: null }) {
        id
        name
        kind
        description
        createdAt
        updatedAt
        isAssignedToDataset(datasetId: $datasetId)
      }
    `,
    row
  );
};

export type TableRow = ReturnType<typeof readRow>;

type EvaluatorsTableProps = {
  /**
   * Relay fragment references for the evaluator rows to display in the table.
   *
   * To obtain row references, spread the EvaluatorsTable_row fragment into an Evaluators connection,
   * pass the resulting edges into this prop.
   */
  rowReferences: EvaluatorsTable_row$key[];
  emptyState?: React.ReactNode;
  isLoadingNext: boolean;
  hasNext: boolean;
  loadNext: (variables: {
    sort?: EvaluatorSort | null;
    filter?: EvaluatorFilter | null;
  }) => void;
  refetch: (variables: {
    sort?: EvaluatorSort | null;
    filter?: EvaluatorFilter | null;
  }) => void;
  onRowClick?: (row: TableRow) => void;
};

export const EvaluatorsTable = ({
  rowReferences,
  emptyState,
  isLoadingNext,
  hasNext,
  loadNext,
  refetch,
  onRowClick,
}: EvaluatorsTableProps) => {
  "use no memo";
  const {
    selectedEvaluatorIds,
    setSelectedEvaluatorIds,
    sort,
    setSort,
    filter,
  } = useEvaluatorsFilterContext();
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
  const columns: ColumnDef<TableRow>[] = useMemo(() => {
    return [
      {
        id: "select",
        maxSize: 32,
        header: ({ table }) => (
          <IndeterminateCheckboxCell
            {...{
              isSelected: table.getIsAllRowsSelected(),
              isIndeterminate: table.getIsSomeRowsSelected(),
              onChange: table.toggleAllRowsSelected,
            }}
          />
        ),
        cell: ({ row }) => (
          <IndeterminateCheckboxCell
            {...{
              isSelected: row.getIsSelected(),
              isDisabled: !row.getCanSelect(),
              isIndeterminate: row.getIsSomeSelected(),
              onChange: row.toggleSelected,
            }}
          />
        ),
      },
      {
        header: "name",
        accessorKey: "name",
      },
      {
        header: "kind",
        accessorKey: "kind",
        cell: ({ getValue }) => <Token>{getValue() as string}</Token>,
      },
      {
        header: "description",
        accessorKey: "description",
        cell: TextCell,
        enableSorting: false,
      },
      {
        header: "last updated",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
    ];
  }, []);
  const rowSelection = useMemo(() => {
    return selectedEvaluatorIds.reduce(
      (acc, id) => {
        acc[id] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [selectedEvaluatorIds]);
  const setRowSelection = useCallback(
    (rowSelection: Updater<Record<string, boolean>>) => {
      setSelectedEvaluatorIds((prevSelection) => {
        if (typeof rowSelection === "function") {
          return Object.keys(
            rowSelection(
              prevSelection.reduce(
                (acc, id) => {
                  acc[id] = true;
                  return acc;
                },
                {} as Record<string, boolean>
              )
            )
          );
        }
        return Object.keys(rowSelection);
      });
    },
    [setSelectedEvaluatorIds]
  );
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      rowSelection,
      sorting,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
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
          filter: filter ? { col: "name", value: filter } : null,
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
              col: "name",
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
      <table css={selectableTableCSS}>
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
