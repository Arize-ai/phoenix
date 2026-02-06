import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, readInlineData } from "react-relay";
import { Link, useNavigate } from "react-router";
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  SortingState,
  Updater,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableExpandButton } from "@phoenix/components/table/TableExpandButton";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { EvaluatorsTable_row$key } from "@phoenix/pages/evaluators/__generated__/EvaluatorsTable_row.graphql";
import {
  EvaluatorFilter,
  EvaluatorSort,
} from "@phoenix/pages/evaluators/__generated__/GlobalEvaluatorsTableEvaluatorsQuery.graphql";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";
import { PromptCell } from "@phoenix/pages/evaluators/PromptCell";

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
      fragment EvaluatorsTable_row on Evaluator @inline {
        id
        name
        kind
        description
        createdAt
        updatedAt
        datasets(first: 10) {
          edges {
            node {
              id
              name
            }
          }
        }
        datasetEvaluators {
          id
          name
          description
          updatedAt
          dataset {
            id
            name
          }
          user {
            username
            profilePictureUrl
          }
        }
        ... on LLMEvaluator {
          prompt {
            id
            name
          }
          promptVersionTag {
            name
          }
          user {
            username
            profilePictureUrl
          }
        }
        ... on CodeEvaluator {
          user {
            username
            profilePictureUrl
          }
        }
      }
    `,
    row
  );
};

export type TableRow = ReturnType<typeof readRow>;

type DatasetEvaluatorData = NonNullable<TableRow["datasetEvaluators"]>[number];

// Parent row (Evaluator)
type EvaluatorRow = {
  rowType: "evaluator";
  data: TableRow;
  children: DatasetEvaluatorRow[];
};

// Child row (DatasetEvaluator)
type DatasetEvaluatorRow = {
  rowType: "datasetEvaluator";
  data: DatasetEvaluatorData;
  children: readonly []; // Leaf nodes have no children
};

// Union type for the table
type NestedTableRow = EvaluatorRow | DatasetEvaluatorRow;

type EvaluatorsTableProps = {
  /**
   * Relay fragment references for the evaluator rows to display in the table.
   *
   * To obtain row references, spread the EvaluatorsTable_row fragment into an Evaluators connection,
   * pass the resulting edges into this prop.
   */
  rowReferences: EvaluatorsTable_row$key[];
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
};

export const EvaluatorsTable = ({
  rowReferences,
  isLoadingNext,
  hasNext,
  loadNext,
  refetch,
}: EvaluatorsTableProps) => {
  "use no memo";
  const navigate = useNavigate();
  const { sort, setSort, filter } = useEvaluatorsFilterContext();
  const { fullTimeFormatter } = useTimeFormatters();
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
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const tableData = useMemo(() => {
    return rowReferences.map(readRow).map((evaluator) => ({
      rowType: "evaluator" as const,
      data: evaluator,
      children: evaluator.datasetEvaluators.map((de) => ({
        rowType: "datasetEvaluator" as const,
        data: de,
        children: [] as const,
      })),
    }));
  }, [rowReferences]);
  const columns = useMemo(() => {
    const cols: ColumnDef<NestedTableRow>[] = [
      {
        header: ({ table }) => (
          <Flex gap="size-50" direction="row" alignItems="center">
            <TableExpandButton
              isExpanded={table.getIsAllRowsExpanded()}
              onClick={table.getToggleAllRowsExpandedHandler()}
              aria-label="Expand all rows"
            />
            name
          </Flex>
        ),
        accessorKey: "name",
        cell: ({ row }) => {
          const name = row.original.data.name;
          return (
            <div style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
              <Flex gap="size-50" alignItems="center">
                {row.getCanExpand() ? (
                  <TableExpandButton
                    isExpanded={row.getIsExpanded()}
                    onClick={row.getToggleExpandedHandler()}
                    aria-label="Expand row"
                  />
                ) : null}
                {row.original.rowType === "datasetEvaluator" ? (
                  <Link
                    to={`/datasets/${row.original.data.dataset.id}/evaluators/${row.original.data.id}`}
                  >
                    {name}
                  </Link>
                ) : (
                  <span>{name}</span>
                )}
              </Flex>
            </div>
          );
        },
      },
      {
        header: "kind",
        accessorKey: "kind",
        size: 80,
        cell: ({ row }) => {
          if (row.original.rowType === "evaluator") {
            return <EvaluatorKindToken kind={row.original.data.kind} />;
          }
          return <Text color="text-700">—</Text>;
        },
      },
      {
        header: "description",
        accessorKey: "description",
        cell: ({ row }) => {
          const description = row.original.data.description;
          if (!description) {
            return <span>--</span>;
          }

          return <Truncate maxWidth="25rem">{description}</Truncate>;
        },
        enableSorting: false,
        size: 320,
      },
      {
        header: "prompt",
        accessorKey: "prompt",
        enableSorting: false,
        cell: ({ row }) => {
          // TODO: should dataset evaluators have a prompt?
          if (row.original.rowType === "evaluator") {
            return (
              <PromptCell
                prompt={row.original.data.prompt}
                promptVersionTag={row.original.data.promptVersionTag?.name}
                wrapWidth={200}
              />
            );
          }
          return <Text color="text-700">—</Text>;
        },
      },
      {
        header: "used in",
        accessorKey: "datasets",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.rowType === "evaluator") {
            const datasets = row.original.data.datasets?.edges ?? [];
            if (datasets.length === 0) {
              return <Text color="text-700">—</Text>;
            }
            return (
              <Flex direction="row" gap="size-100" wrap="wrap">
                {datasets.map(({ node }) => (
                  <Link key={node.id} to={`/datasets/${node.id}`}>
                    {node.name}
                  </Link>
                ))}
              </Flex>
            );
          }
          return (
            <Link to={`/datasets/${row.original.data.dataset.id}`}>
              {row.original.data.dataset.name}
            </Link>
          );
        },
      },
      {
        header: "last modified by",
        accessorKey: "user",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original.data.user;
          if (!user) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <UserPicture
                name={user.username ?? undefined}
                profilePictureUrl={user.profilePictureUrl}
                size={20}
              />
              <Text>{user.username ?? "system"}</Text>
            </Flex>
          );
        },
      },
      {
        header: "last updated",
        accessorKey: "updatedAt",
        cell: ({ row }) => {
          const updatedAt = row.original.data.updatedAt;
          const timestamp =
            updatedAt != null ? fullTimeFormatter(new Date(updatedAt)) : "--";
          return (
            <time title={updatedAt != null ? String(updatedAt) : ""}>
              {timestamp}
            </time>
          );
        },
      },
    ];
    return cols;
  }, [fullTimeFormatter]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) =>
      row.rowType === "evaluator" && row.children.length > 0
        ? row.children
        : undefined,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowId: (row) => row.data.id,
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
    return <EmptyState />;
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
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={{
                    minWidth: header.column.columnDef.size,
                  }}
                >
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
            const rowIsExpandable = row.getCanExpand();
            return (
              <tr
                key={row.id}
                data-depth={row.depth}
                style={{
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (rowIsExpandable) {
                    row.toggleExpanded();
                  } else if (row.original.rowType === "datasetEvaluator") {
                    navigate(
                      `/datasets/${row.original.data.dataset.id}/evaluators/${row.original.data.id}`
                    );
                  }
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
