import { css } from "@emotion/react";
import type {
  CellContext,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";
import {
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
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Link,
  LinkButton,
  Token,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  ACTIONS_COLUMN_ID,
  CellWithControlsWrap,
  ColumnHeaderCell,
  ColumnOrderingProvider,
  CompactJSONCell,
  useColumnOrder,
  UserCell,
} from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useNotifySuccess, useViewerCanModify } from "@phoenix/contexts";
import { useDatasetsTableContext } from "@phoenix/contexts/DatasetsTableContext";
import { toggleArrayItem } from "@phoenix/utils/arrayUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type { DatasetsTable_datasets$key } from "./__generated__/DatasetsTable_datasets.graphql";
import type {
  DatasetSort,
  DatasetsTableDatasetsQuery,
} from "./__generated__/DatasetsTableDatasetsQuery.graphql";
import { DatasetActionMenu } from "./DatasetActionMenu";
import { DatasetsEmpty } from "./DatasetsEmpty";
const PAGE_SIZE = 100;

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

type DatasetsTableProps = {
  query: DatasetsTable_datasets$key;
  filter: string;
  labelFilter?: string[];
  onLabelFilterChange?: Dispatch<SetStateAction<string[]>>;
};

function toGqlSort(sort: SortingState[number]): DatasetSort {
  const col = sort.id;
  if (col !== "createdAt" && col !== "name") {
    throw new Error("Invalid sort column");
  }
  return {
    col,
    dir: sort.desc ? "desc" : "asc",
  };
}

export function DatasetsTable(props: DatasetsTableProps) {
  "use no memo";
  const { filter, labelFilter, onLabelFilterChange } = props;
  const [sorting, setSorting] = useState<SortingState>([]);

  const toggleLabelFilter = useCallback(
    (labelId: string) => {
      onLabelFilterChange?.((prev) => toggleArrayItem(prev, labelId));
    },
    [onLabelFilterChange]
  );
  const columnVisibility = useDatasetsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useDatasetsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnSizing = useDatasetsTableContext((state) => state.columnSizing);
  const setColumnSizing = useDatasetsTableContext(
    (state) => state.setColumnSizing
  );
  const columnOrder = useDatasetsTableContext((state) => state.columnOrder);
  const setColumnOrder = useDatasetsTableContext(
    (state) => state.setColumnOrder
  );
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      DatasetsTableDatasetsQuery,
      DatasetsTable_datasets$key
    >(
      graphql`
        fragment DatasetsTable_datasets on Query
        @refetchable(queryName: "DatasetsTableDatasetsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          sort: {
            type: "DatasetSort"
            defaultValue: { col: createdAt, dir: desc }
          }
          filter: { type: "DatasetFilter", defaultValue: null }
        ) {
          datasets(first: $first, after: $after, sort: $sort, filter: $filter)
            @connection(key: "DatasetsTable_datasets") {
            edges {
              node {
                id
                name
                description
                metadata
                createdAt
                updatedAt
                createdBy {
                  username
                  profilePictureUrl
                }
                updatedBy {
                  username
                  profilePictureUrl
                }
                exampleCount
                experimentCount
                evaluatorCount
                labels {
                  id
                  name
                  color
                }
              }
            }
          }
        }
      `,
      props.query
    );
  const tableData = useMemo(
    () => data.datasets.edges.map((edge) => edge.node),
    [data]
  );
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
          loadNext(PAGE_SIZE, {
            UNSTABLE_extraVariables: {
              filter:
                filter || labelFilter?.length
                  ? {
                      col: "name",
                      value: filter || "",
                      ...(labelFilter?.length
                        ? { filterLabels: labelFilter }
                        : {}),
                    }
                  : null,
            },
          });
        }
      }
    },
    [hasNext, isLoadingNext, loadNext, filter, labelFilter]
  );
  const canModify = useViewerCanModify();
  const columns = useMemo(() => {
    const cols: ColumnDef<(typeof tableData)[number]>[] = [
      {
        header: "name",
        accessorKey: "name",
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => {
          const hasExperiments = row.original.experimentCount > 0;
          const to = hasExperiments
            ? `${row.original.id}/experiments`
            : `${row.original.id}/examples`;
          return (
            <CellWithControlsWrap
              controls={<CopyToClipboardButton text={row.original.name} />}
            >
              <Truncate>
                <Link to={to}>{row.original.name}</Link>
              </Truncate>
            </CellWithControlsWrap>
          );
        },
      },
      {
        header: "labels",
        accessorKey: "labels",
        enableSorting: false,
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => {
          return (
            <ul
              css={css`
                display: flex;
                flex-direction: row;
                gap: var(--global-dimension-size-100);
                min-width: 0;
                flex-wrap: wrap;
              `}
            >
              {row.original.labels.map((label) => (
                <li key={label.id}>
                  <StopPropagation>
                    <Token
                      color={label.color}
                      onPress={() => toggleLabelFilter(label.id)}
                      aria-label={`Filter datasets by label ${label.name}`}
                    >
                      <Truncate maxWidth={200} title={label.name}>
                        {label.name}
                      </Truncate>
                    </Token>
                  </StopPropagation>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: "description",
        accessorKey: "description",
        enableSorting: false,
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <span
            css={css`
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              display: block;
            `}
            title={row.original.description ?? undefined}
          >
            {row.original.description}
          </span>
        ),
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "created by",
        accessorKey: "createdBy",
        enableSorting: false,
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <UserCell user={row.original.createdBy} />
        ),
      },
      {
        header: "last updated",
        accessorKey: "updatedAt",
        enableSorting: false,
        cell: TimestampCell,
      },
      {
        header: "last updated by",
        accessorKey: "updatedBy",
        enableSorting: false,
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <UserCell user={row.original.updatedBy} />
        ),
      },
      {
        header: "examples",
        accessorKey: "exampleCount",
        enableSorting: false,
        meta: {
          textAlign: "right" as const,
        },
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <StopPropagation>
            <Link to={`${row.original.id}/examples`}>
              {row.original.exampleCount}
            </Link>
          </StopPropagation>
        ),
      },
      {
        header: "experiments",
        accessorKey: "experimentCount",
        enableSorting: false,
        meta: {
          textAlign: "right" as const,
        },
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <StopPropagation>
            <Link to={`${row.original.id}/experiments`}>
              {row.original.experimentCount}
            </Link>
          </StopPropagation>
        ),
      },
      {
        header: "evaluators",
        accessorKey: "evaluatorCount",
        enableSorting: false,
        meta: {
          textAlign: "right" as const,
        },
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => (
          <StopPropagation>
            <Link to={`${row.original.id}/evaluators`}>
              {row.original.evaluatorCount}
            </Link>
          </StopPropagation>
        ),
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        enableSorting: false,
        cell: CompactJSONCell,
      },
    ];
    if (canModify) {
      cols.push({
        header: "",
        id: ACTIONS_COLUMN_ID,
        enableSorting: false,
        size: 150,
        cell: ({ row }: CellContext<(typeof tableData)[number], unknown>) => {
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <StopPropagation>
                <LinkButton
                  size="S"
                  to={`/playground?datasetId=${row.original.id}`}
                  leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
                  aria-label="Open dataset in Playground"
                >
                  Playground
                </LinkButton>
              </StopPropagation>
              <DatasetActionMenu
                datasetId={row.original.id}
                datasetName={row.original.name}
                datasetDescription={row.original.description}
                datasetMetadata={row.original.metadata}
                onDatasetEdit={() => {
                  notifySuccess({
                    title: "Dataset updated",
                    message: `${row.original.name} has been successfully updated.`,
                  });
                  refetch(
                    {
                      filter:
                        filter || labelFilter?.length
                          ? {
                              col: "name",
                              value: filter || "",
                              ...(labelFilter?.length
                                ? { filterLabels: labelFilter }
                                : {}),
                            }
                          : null,
                    },
                    { fetchPolicy: "store-and-network" }
                  );
                }}
                onDatasetDelete={() => {
                  notifySuccess({
                    title: "Dataset deleted",
                    message: `${row.original.name} has been successfully deleted.`,
                  });
                  refetch(
                    {
                      filter:
                        filter || labelFilter?.length
                          ? {
                              col: "name",
                              value: filter || "",
                              ...(labelFilter?.length
                                ? { filterLabels: labelFilter }
                                : {}),
                            }
                          : null,
                    },
                    { fetchPolicy: "store-and-network" }
                  );
                }}
              />
            </Flex>
          );
        },
      });
    }
    return cols;
  }, [
    filter,
    labelFilter,
    notifySuccess,
    refetch,
    canModify,
    toggleLabelFilter,
  ]);

  const {
    leafColumnOrder,
    visibleColumnOrder,
    onVisibleColumnOrderChange,
    getColumnOrderIndex,
  } = useColumnOrder({
    columns,
    columnOrder,
    onColumnOrderChange: setColumnOrder,
    columnVisibility,
    nonOrderableColumnIds: [ACTIONS_COLUMN_ID],
  });

  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      sorting,
      columnSizing,
      columnVisibility,
      columnOrder: leafColumnOrder,
      columnPinning: {
        right: [ACTIONS_COLUMN_ID],
      },
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: true,
  });

  useEffect(() => {
    //if the sorting changes, we need to reset the pagination
    const sort = sorting[0];

    startTransition(() => {
      refetch(
        {
          sort: sort ? toGqlSort(sort) : { col: "createdAt", dir: "desc" },
          after: null,
          first: PAGE_SIZE,
          filter:
            filter || labelFilter?.length
              ? {
                  col: "name",
                  value: filter || "",
                  ...(labelFilter?.length ? { filterLabels: labelFilter } : {}),
                }
              : null,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [sorting, refetch, filter, labelFilter]);
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;

  /**
   * Calculate all column sizes at once as CSS variables for performance
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return colSizes;
    // Disabled lint as per tanstack docs linked above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState]);

  return (
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
          data-testid="datasets-table"
          css={selectableTableCSS}
          style={{
            ...columnSizeVars,
            width: table.getTotalSize(),
            minWidth: "100%",
          }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  return (
                    <ColumnHeaderCell
                      colSpan={header.colSpan}
                      key={header.id}
                      columnId={header.column.id}
                      index={getColumnOrderIndex(header.column.id)}
                      label={
                        typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : undefined
                      }
                      aria-sort={
                        sortDir === "asc"
                          ? "ascending"
                          : sortDir === "desc"
                            ? "descending"
                            : header.column.getCanSort()
                              ? "none"
                              : undefined
                      }
                      style={{
                        width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                        ...getCommonPinningStyles(header.column),
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
                                textAlign:
                                  header.column.columnDef.meta?.textAlign,
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
                  );
                })}
              </tr>
            ))}
          </thead>
          {isEmpty ? (
            <TableEmptyWrap>
              <DatasetsEmpty />
            </TableEmptyWrap>
          ) : (
            <tbody>
              {rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      const hasExperiments = row.original.experimentCount > 0;
                      const to = hasExperiments
                        ? `${row.original.id}/experiments`
                        : `${row.original.id}/examples`;
                      navigate(to);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colSizeVar = `--col-${makeSafeColumnId(cell.column.id)}-size`;
                      return (
                        <td
                          key={cell.id}
                          align={cell.column.columnDef.meta?.textAlign}
                          style={{
                            width: `calc(var(${colSizeVar}) * 1px)`,
                            maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                            ...getCommonPinningStyles(cell.column),
                          }}
                        >
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
      </ColumnOrderingProvider>
    </div>
  );
}
