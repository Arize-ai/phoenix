import { useCallback, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  Updater,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, Token, View } from "@phoenix/components";
import { TextCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { EvaluatorsTable_evaluators$key } from "@phoenix/pages/evaluators/__generated__/EvaluatorsTable_evaluators.graphql";
import { EvaluatorsTableEvaluatorsQuery } from "@phoenix/pages/evaluators/__generated__/EvaluatorsTableEvaluatorsQuery.graphql";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

const PAGE_SIZE = 100;

type EvaluatorsTableProps = {
  query: EvaluatorsTable_evaluators$key;
};

export const EvaluatorsTable = ({ query }: EvaluatorsTableProps) => {
  const { selectedEvaluatorIds, setSelectedEvaluatorIds } =
    useEvaluatorsFilterContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment<
    EvaluatorsTableEvaluatorsQuery,
    EvaluatorsTable_evaluators$key
  >(
    graphql`
      fragment EvaluatorsTable_evaluators on Query
      @refetchable(queryName: "EvaluatorsTableEvaluatorsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        evaluators(first: $first, after: $after)
          @connection(key: "EvaluatorsTable_evaluators") {
          edges {
            evaluator: node {
              id
              name
              createdAt
              updatedAt
              description
              kind
            }
          }
        }
      }
    `,
    query
  );
  const tableData = useMemo(
    () => data.evaluators.edges.map((edge) => edge.evaluator),
    [data]
  );
  type TableRow = (typeof tableData)[number];
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
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
  });
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
          loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: {} });
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
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
        </Flex>
      </View>
    );
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
                  navigate(`${row.original.id}`);
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
