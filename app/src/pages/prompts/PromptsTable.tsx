import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Text,
  Token,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  ACTIONS_COLUMN_ID,
  CellWithControlsWrap,
  ColumnHeaderCell,
  ColumnOrderingProvider,
  TextCell,
  useColumnOrder,
  UserCell,
} from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useViewerCanModify } from "@phoenix/contexts";
import { usePromptsTableContext } from "@phoenix/contexts/PromptsTableContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";
import { PromptsFilterBar } from "@phoenix/pages/prompts/PromptsFilterBar";
import { usePromptsFilterContext } from "@phoenix/pages/prompts/PromptsFilterProvider";
import { toggleArrayItem } from "@phoenix/utils/arrayUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type { PromptsTable_prompts$key } from "./__generated__/PromptsTable_prompts.graphql";
import type { PromptsTablePromptsQuery } from "./__generated__/PromptsTablePromptsQuery.graphql";
import { PromptActionMenu } from "./PromptActionMenu";
import { PromptsEmpty } from "./PromptsEmpty";

const PAGE_SIZE = 100;
const PROMPTS_POLL_INTERVAL_MS = 60_000;

const defaultColumnSettings = {
  minSize: 120,
  size: 200,
} satisfies Partial<ColumnDef<unknown>>;

const promptsTableCSS = css`
  th,
  td {
    white-space: nowrap;
  }
  td {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const tokenListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  flex-wrap: nowrap;
  overflow: hidden;
`;

type PromptsTableProps = {
  query: PromptsTable_prompts$key;
};

export function PromptsTable(props: PromptsTableProps) {
  "use no memo";
  const { filter, selectedPromptLabelIds, setSelectedPromptLabelIds } =
    usePromptsFilterContext();
  const columnVisibility = usePromptsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = usePromptsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnSizing = usePromptsTableContext((state) => state.columnSizing);
  const setColumnSizing = usePromptsTableContext(
    (state) => state.setColumnSizing
  );
  const columnOrder = usePromptsTableContext((state) => state.columnOrder);
  const setColumnOrder = usePromptsTableContext(
    (state) => state.setColumnOrder
  );
  const navigate = useNavigate();

  const toggleLabelFilter = useCallback(
    (labelId: string) => {
      setSelectedPromptLabelIds((prev) => toggleArrayItem(prev, labelId));
    },
    [setSelectedPromptLabelIds]
  );
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const queryArgs = useMemo(
    () => ({
      filter: filter.trim() ? { value: filter, col: "name" as const } : null,
      labelIds:
        selectedPromptLabelIds.length > 0 ? selectedPromptLabelIds : null,
    }),
    [filter, selectedPromptLabelIds]
  );

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<PromptsTablePromptsQuery, PromptsTable_prompts$key>(
      graphql`
        fragment PromptsTable_prompts on Query
        @refetchable(queryName: "PromptsTablePromptsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          filter: { type: "PromptFilter", defaultValue: null }
          labelIds: { type: "[ID!]", defaultValue: null }
        ) {
          prompts(
            first: $first
            after: $after
            filter: $filter
            labelIds: $labelIds
          ) @connection(key: "PromptsTable_prompts") {
            edges {
              prompt: node {
                id
                name
                description
                createdBy {
                  username
                  profilePictureUrl
                }
                updatedBy {
                  username
                  profilePictureUrl
                }
                version {
                  id
                  createdAt
                  modelName
                  modelProvider
                }
                versionCount
                versionTags {
                  id
                  name
                  promptVersionId
                }
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

  const refreshPrompts = useCallback(
    (variables?: Partial<PromptsTablePromptsQuery["variables"]>) => {
      startTransition(() => {
        refetch(
          {
            ...queryArgs,
            ...variables,
          },
          {
            fetchPolicy: "store-and-network",
          }
        );
      });
    },
    [refetch, queryArgs]
  );

  // Refetch when searchFilter changes
  useEffect(() => {
    refreshPrompts();
  }, [refreshPrompts]);

  useInterval(() => {
    const loadedPromptCount = data.prompts.edges.length;
    refreshPrompts({
      first: Math.max(PAGE_SIZE, loadedPromptCount),
    });
  }, PROMPTS_POLL_INTERVAL_MS);

  const tableData = useMemo(
    () =>
      data.prompts.edges.map((edge) => {
        return {
          lastUpdatedAt: edge.prompt.version.createdAt,
          modelName: edge.prompt.version.modelName,
          modelProvider: edge.prompt.version.modelProvider,
          latestVersionId: edge.prompt.version.id,
          ...edge.prompt,
        };
      }),
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
          loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: queryArgs });
        }
      }
    },
    [hasNext, isLoadingNext, loadNext, queryArgs]
  );
  const canModify = useViewerCanModify();

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "name",
        accessorKey: "name",
        cell: ({ row }) => {
          return (
            <CellWithControlsWrap
              controls={<CopyToClipboardButton text={row.original.name} />}
            >
              <Link to={`${row.original.id}`}>{row.original.name}</Link>
            </CellWithControlsWrap>
          );
        },
      },
      {
        header: "labels",
        accessorKey: "labels",
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <ul css={tokenListCSS}>
              {row.original.labels.map((label) => (
                <li key={label.id}>
                  <StopPropagation>
                    <Token
                      color={label.color ?? undefined}
                      onPress={() => toggleLabelFilter(label.id)}
                      aria-label={`Filter prompts by label ${label.name}`}
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
        cell: TextCell,
      },
      {
        header: "model",
        accessorKey: "modelName",
        cell: ({ row }) => {
          const { modelName, modelProvider } = row.original;
          if (!modelName) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={modelProvider} height={16} />
              <Text minWidth={0}>
                <Truncate>{modelName}</Truncate>
              </Text>
            </Flex>
          );
        },
      },
      {
        header: "versions",
        accessorKey: "versionCount",
        meta: {
          textAlign: "right" as const,
        },
        cell: ({ row }) => (
          <StopPropagation>
            <Link to={`${row.original.id}/versions`}>
              {row.original.versionCount}
            </Link>
          </StopPropagation>
        ),
      },
      {
        header: "latest version",
        accessorKey: "latestVersionId",
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <CellWithControlsWrap
              controls={
                <CopyToClipboardButton text={row.original.latestVersionId} />
              }
            >
              <Link
                to={`${row.original.id}/versions/${row.original.latestVersionId}`}
              >
                <Truncate maxWidth={200} title={row.original.latestVersionId}>
                  {row.original.latestVersionId}
                </Truncate>
              </Link>
            </CellWithControlsWrap>
          );
        },
      },
      {
        header: "version tags",
        accessorKey: "versionTags",
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <ul css={tokenListCSS}>
              {row.original.versionTags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    to={`${row.original.id}/versions/${tag.promptVersionId}`}
                  >
                    <TagVersionLabel maxWidth={200}>{tag.name}</TagVersionLabel>
                  </Link>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: "created by",
        accessorKey: "createdBy",
        enableSorting: false,
        cell: ({ row }) => <UserCell user={row.original.createdBy} />,
      },
      {
        header: "last updated by",
        accessorKey: "updatedBy",
        enableSorting: false,
        cell: ({ row }) => <UserCell user={row.original.updatedBy} />,
      },
      {
        header: "last updated",
        accessorKey: "lastUpdatedAt",
        cell: TimestampCell,
      },
    ];
    if (canModify) {
      cols.push({
        id: ACTIONS_COLUMN_ID,
        header: "",
        size: 150,
        enableSorting: false,
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              gap="size-100"
              justifyContent="end"
              width="100%"
            >
              <StopPropagation>
                <LinkButton
                  leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
                  size="S"
                  aria-label="Open in playground"
                  to={`/playground?promptId=${encodeURIComponent(row.original.id)}`}
                >
                  Playground
                </LinkButton>
              </StopPropagation>
              <PromptActionMenu
                promptId={row.original.id}
                onDeleted={() => {
                  refetch(queryArgs, { fetchPolicy: "network-only" });
                }}
              />
            </Flex>
          );
        },
      });
    }
    return cols;
  }, [refetch, queryArgs, canModify, toggleLabelFilter]);

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

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      columnSizing,
      columnVisibility,
      columnOrder: leafColumnOrder,
      columnPinning: {
        right: [ACTIONS_COLUMN_ID],
      },
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  const columnSizeVars = useMemo(() => {
    const headers = getFlatHeaders();
    const columnSizes: Record<string, number> = {};
    for (const header of headers) {
      columnSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      columnSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return columnSizes;
    // Disabled lint as per TanStack's performant column resizing example.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState]);

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <div
      css={css`
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      `}
    >
      <PromptsFilterBar />
      {isEmpty ? (
        <PromptsEmpty />
      ) : (
        <div
          css={css`
            flex: 1 1 auto;
            overflow: auto;
          `}
          onScroll={(event) =>
            fetchMoreOnBottomReached(event.target as HTMLDivElement)
          }
          ref={tableContainerRef}
        >
          <ColumnOrderingProvider
            columnOrder={visibleColumnOrder}
            onColumnOrderChange={onVisibleColumnOrderChange}
          >
            <table
              css={[selectableTableCSS, promptsTableCSS]}
              data-testid="prompts-table"
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
                          colSpan={header.colSpan}
                          style={{
                            ...getCommonPinningStyles(header.column),
                            width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                          }}
                        >
                          {header.isPlaceholder ? null : (
                            <>
                              <div
                                className={
                                  header.column.getCanSort() ? "sort" : ""
                                }
                                onClick={header.column.getToggleSortingHandler()}
                                style={{
                                  textAlign:
                                    header.column.columnDef.meta?.textAlign,
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
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`resizer ${
                                  header.column.getIsResizing()
                                    ? "isResizing"
                                    : ""
                                }`}
                              />
                            </>
                          )}
                        </ColumnHeaderCell>
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
                          style={{
                            ...getCommonPinningStyles(cell.column),
                            width: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                            maxWidth: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                          }}
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
            </table>
          </ColumnOrderingProvider>
        </div>
      )}
    </div>
  );
}
