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

import { Flex, Icon, Icons, Link, Text } from "@phoenix/components";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { formatBuiltinEvaluatorDisplayName } from "@phoenix/components/evaluators/utils";
import { TextCell } from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { LineClamp } from "@phoenix/components/utility/LineClamp";
import { DatasetEvaluatorsPage_builtInEvaluators$data } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsPage_builtInEvaluators.graphql";
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
  "name",
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

const evaluatorItemButtonCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
  height: 90px;
  padding: var(--ac-global-dimension-size-200);
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid var(--ac-global-border-color-default);
  background-color: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: var(--ac-global-color-grey-200);
  }
`;

const evaluatorColumnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-125);
  flex: 1;
`;

const EmptyState = ({
  builtInEvaluators,
  onSelectLLMEvaluatorTemplate,
  onSelectCodeEvaluator,
  hasActiveFilter,
}: {
  builtInEvaluators: DatasetEvaluatorsPage_builtInEvaluators$data;
  onSelectLLMEvaluatorTemplate?: (templateName: string) => void;
  onSelectCodeEvaluator?: (evaluatorId: string) => void;
  hasActiveFilter: boolean;
}) => {
  const codeEvaluators = useMemo(
    () =>
      builtInEvaluators.builtInEvaluators.map((evaluator) => ({
        ...evaluator,
        name: formatBuiltinEvaluatorDisplayName(evaluator.name),
      })),
    [builtInEvaluators.builtInEvaluators]
  );
  const llmEvaluatorTemplates =
    builtInEvaluators.classificationEvaluatorConfigs;

  // If there's an active filter, show a simple "no results" message
  if (hasActiveFilter) {
    return (
      <TableEmptyWrap>
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap="size-300"
          maxWidth="700px"
          margin="var(--ac-global-dimension-size-300) auto"
        >
          <Text size="S" fontStyle="italic" color="text-500">
            No evaluators found that match the given filter.
          </Text>
        </Flex>
      </TableEmptyWrap>
    );
  }

  // Otherwise, show the template selection grid
  return (
    <TableEmptyWrap>
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        gap="size-300"
        maxWidth="700px"
        margin="var(--ac-global-dimension-size-300) auto"
      >
        <Text size="S" fontStyle="italic" color="text-500">
          No evaluators added to this dataset
        </Text>
        <Flex direction="row" gap="size-125">
          {/* LLM Evaluator Templates */}
          <div css={evaluatorColumnCSS}>
            {llmEvaluatorTemplates.map((template) => (
              <button
                key={template.name}
                css={evaluatorItemButtonCSS}
                onClick={() => {
                  onSelectLLMEvaluatorTemplate?.(template.name);
                }}
              >
                <Text size="S" weight="heavy">
                  {template.name}
                </Text>
                <LineClamp lines={2}>
                  <Text size="XS" color="text-700">
                    {template.description}
                  </Text>
                </LineClamp>
              </button>
            ))}
          </div>
          {/* Code Evaluators */}
          <div css={evaluatorColumnCSS}>
            {codeEvaluators.map((evaluator) => (
              <button
                key={evaluator.id}
                css={evaluatorItemButtonCSS}
                onClick={() => {
                  onSelectCodeEvaluator?.(evaluator.id);
                }}
              >
                <Text size="S" weight="heavy">
                  {evaluator.name}
                </Text>
                <LineClamp lines={2}>
                  <Text size="XS" color="text-700">
                    {evaluator.description}
                  </Text>
                </LineClamp>
              </button>
            ))}
          </div>
        </Flex>
      </Flex>
    </TableEmptyWrap>
  );
};

const readRow = (row: DatasetEvaluatorsTable_row$key) => {
  return readInlineData(
    graphql`
      fragment DatasetEvaluatorsTable_row on DatasetEvaluator @inline {
        id
        name
        description
        updatedAt
        user {
          username
          profilePictureUrl
        }
        evaluator {
          id
          name
          kind
          createdAt
          updatedAt
          isBuiltin
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
  /**
   * Built-in evaluators data to display in the empty state.
   */
  builtInEvaluators: DatasetEvaluatorsPage_builtInEvaluators$data;
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
  datasetId: string;
  /**
   * If provided, these connections will be updated when a row is edited or deleted.
   */
  updateConnectionIds?: string[];
  /**
   * Callback for when an LLM evaluator template is selected from the empty state.
   */
  onSelectLLMEvaluatorTemplate?: (templateName: string) => void;
  /**
   * Callback for when a code evaluator is selected from the empty state.
   */
  onSelectCodeEvaluator?: (evaluatorId: string) => void;
};

export const DatasetEvaluatorsTable = ({
  rowReferences,
  builtInEvaluators,
  isLoadingNext,
  hasNext,
  loadNext,
  refetch,
  onRowClick,
  datasetId,
  updateConnectionIds,
  onSelectLLMEvaluatorTemplate,
  onSelectCodeEvaluator,
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
        accessorKey: "name",
        cell: ({ getValue, row }) => {
          return (
            <Link to={`/datasets/${datasetId}/evaluators/${row.original.id}`}>
              {getValue() as string}
            </Link>
          );
        },
      },
      {
        header: "kind",
        accessorKey: "kind", // special case for sorting that's handled by the backend
        accessorFn: (row) => row.evaluator.kind,
        size: 80,
        cell: ({ getValue }) => (
          <EvaluatorKindToken kind={getValue() as "LLM" | "CODE"} />
        ),
      },
      {
        header: "description",
        accessorKey: "description",
        cell: TextCell,
        enableSorting: false,
        size: 320,
      },
      {
        header: "prompt",
        accessorKey: "prompt",
        enableSorting: false,
        cell: ({ row }) => (
          <PromptCell
            prompt={row.original.evaluator.prompt}
            promptVersionTag={row.original.evaluator.promptVersionTag?.name}
            wrapWidth={200}
          />
        ),
      },
      {
        header: "last modified by",
        accessorKey: "user",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original.user;
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
            datasetId={datasetId}
            evaluatorKind={row.original.evaluator.kind}
            evaluatorName={row.original.name}
            isBuiltIn={row.original.evaluator.isBuiltin}
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
        {isEmpty ? (
          <EmptyState
            builtInEvaluators={builtInEvaluators}
            onSelectLLMEvaluatorTemplate={onSelectLLMEvaluatorTemplate}
            onSelectCodeEvaluator={onSelectCodeEvaluator}
            hasActiveFilter={!!filter}
          />
        ) : (
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
};
