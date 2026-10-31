import { css } from "@emotion/react";
import type { RowData } from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useResolvedPath } from "react-router";

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
  ACTIONS_COLUMN_PINNING,
  CellWithControlsWrap,
  ColumnHeaderCell,
  ColumnOrderingProvider,
  TextCell,
  useColumnOrder,
} from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { UserDisplay } from "@phoenix/components/user/UserDisplay";
import { useViewerCanModify } from "@phoenix/contexts";
import { useInterval } from "@phoenix/hooks/useInterval";
import { DecisionsFilterBar } from "@phoenix/pages/decisions/DecisionsFilterBar";
import { useDecisionsFilterContext } from "@phoenix/pages/decisions/DecisionsFilterProvider";
import { useDecisionsTableContext } from "@phoenix/pages/decisions/DecisionsTableContext";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";
import { toggleArrayItem } from "@phoenix/utils/arrayUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type { DecisionsTable_decisions$key } from "./__generated__/DecisionsTable_decisions.graphql";
import type { DecisionsTableDecisionsQuery } from "./__generated__/DecisionsTableDecisionsQuery.graphql";
import { DecisionActionMenu } from "./DecisionActionMenu";
import { DecisionsEmpty } from "./DecisionsEmpty";

const PAGE_SIZE = 100;
const DECISIONS_POLL_INTERVAL_MS = 60_000;

const defaultColumnSettings = {
  minSize: 120,
  size: 200,
} satisfies Partial<ColumnDef<RowData>>;

const decisionsTableCSS = css`
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

type DecisionsTableProps = {
  query: DecisionsTable_decisions$key;
};

export function DecisionsTable(props: DecisionsTableProps) {
  const { filter, selectedDecisionLabelIds, setSelectedDecisionLabelIds } =
    useDecisionsFilterContext();
  const columnVisibility = useDecisionsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useDecisionsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnSizing = useDecisionsTableContext((state) => state.columnSizing);
  const setColumnSizing = useDecisionsTableContext(
    (state) => state.setColumnSizing
  );
  const columnOrder = useDecisionsTableContext((state) => state.columnOrder);
  const setColumnOrder = useDecisionsTableContext(
    (state) => state.setColumnOrder
  );
  const navigate = useNavigate();
  const basePath = useResolvedPath(".").pathname;

  const toggleLabelFilter = useCallback(
    (labelId: string) => {
      setSelectedDecisionLabelIds((prev) => toggleArrayItem(prev, labelId));
    },
    [setSelectedDecisionLabelIds]
  );
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const queryArgs = useMemo(
    () => ({
      filter: filter.trim() ? { value: filter, col: "name" as const } : null,
      labelIds:
        selectedDecisionLabelIds.length > 0 ? selectedDecisionLabelIds : null,
    }),
    [filter, selectedDecisionLabelIds]
  );

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      DecisionsTableDecisionsQuery,
      DecisionsTable_decisions$key
    >(
      graphql`
        fragment DecisionsTable_decisions on Query
        @refetchable(queryName: "DecisionsTableDecisionsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          filter: { type: "DecisionFilter", defaultValue: null }
          labelIds: { type: "[ID!]", defaultValue: null }
        ) {
          decisions(
            first: $first
            after: $after
            filter: $filter
            labelIds: $labelIds
          ) @connection(key: "DecisionsTable_decisions") {
            edges {
              decision: node {
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
                updatedAt
                versionCount
                versionTags {
                  id
                  name
                  decisionVersionId
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

  const refreshDecisions = useCallback(
    (variables?: Partial<DecisionsTableDecisionsQuery["variables"]>) => {
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
    refreshDecisions();
  }, [refreshDecisions]);

  useInterval(() => {
    const loadedDecisionCount = data.decisions.edges.length;
    refreshDecisions({
      first: Math.max(PAGE_SIZE, loadedDecisionCount),
    });
  }, DECISIONS_POLL_INTERVAL_MS);

  const tableData = useMemo(
    () =>
      data.decisions.edges.map((edge) => {
        return {
          lastUpdatedAt:
            edge.decision.version?.createdAt ?? edge.decision.updatedAt,
          modelName: edge.decision.version?.modelName ?? null,
          modelProvider: edge.decision.version?.modelProvider ?? "OPENAI",
          latestVersionId: edge.decision.version?.id ?? "",
          ...edge.decision,
          // An emptied description reads as no description ("--").
          description: edge.decision.description || null,
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
              <Link to={`${basePath}/${row.original.id}`}>
                <Truncate maxWidth="100%">{row.original.name}</Truncate>
              </Link>
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
                      aria-label={`Filter decisions by label ${label.name}`}
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
            <Link to={`${basePath}/${row.original.id}/versions`}>
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
                to={`${basePath}/${row.original.id}/versions/${row.original.latestVersionId}`}
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
                    to={`${basePath}/${row.original.id}/versions/${tag.decisionVersionId}`}
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
        cell: ({ row }) => <UserDisplay user={row.original.createdBy} />,
      },
      {
        header: "last updated by",
        accessorKey: "updatedBy",
        enableSorting: false,
        cell: ({ row }) => <UserDisplay user={row.original.updatedBy} />,
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
                  to={`/playground?decisionId=${encodeURIComponent(row.original.id)}`}
                >
                  Playground
                </LinkButton>
              </StopPropagation>
              <DecisionActionMenu
                decisionId={row.original.id}
                decisionName={row.original.name}
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
  }, [basePath, refetch, queryArgs, canModify, toggleLabelFilter]);

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

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: tableData,
    state: {
      columnSizing,
      columnVisibility,
      columnOrder: leafColumnOrder,
      columnPinning: ACTIONS_COLUMN_PINNING,
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    // Key rows by decision ID rather than by index. Row cells host overlays
    // (the action menu and its label submenu) that are bound to
    // `row.original.id`; with index-based keys a refetch that re-orders the
    // list hands the still-open overlay a different decision's ID, so the next
    // click writes to the wrong decision.
    getRowId: (row) => row.id,
  });

  const columnSizeVars: Record<string, number> = {};
  for (const header of table.getFlatHeaders()) {
    columnSizeVars[`--header-${makeSafeColumnId(header.id)}-size`] =
      header.getSize();
    columnSizeVars[`--col-${makeSafeColumnId(header.column.id)}-size`] =
      header.column.getSize();
  }

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
      <DecisionsFilterBar />
      {isEmpty ? (
        <DecisionsEmpty />
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
              css={[selectableTableCSS, decisionsTableCSS]}
              data-testid="decisions-table"
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
                        navigate(`${basePath}/${row.original.id}`);
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
