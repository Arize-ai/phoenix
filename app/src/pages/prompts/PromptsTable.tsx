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
import { CellWithControlsWrap, TextCell } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useViewerCanModify } from "@phoenix/contexts";
import { useInterval } from "@phoenix/hooks/useInterval";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";
import { usePromptsFilterContext } from "@phoenix/pages/prompts/PromptsFilterProvider";
import { toggleArrayItem } from "@phoenix/utils/arrayUtils";

import type { PromptsTable_prompts$key } from "./__generated__/PromptsTable_prompts.graphql";
import type { PromptsTablePromptsQuery } from "./__generated__/PromptsTablePromptsQuery.graphql";
import { PromptActionMenu } from "./PromptActionMenu";
import { PromptsEmpty } from "./PromptsEmpty";

const PAGE_SIZE = 100;
const PROMPTS_POLL_INTERVAL_MS = 60_000;

const tokenListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  flex-wrap: wrap;
`;

type PromptsTableProps = {
  query: PromptsTable_prompts$key;
};

export function PromptsTable(props: PromptsTableProps) {
  "use no memo";
  const { filter, selectedPromptLabelIds, setSelectedPromptLabelIds } =
    usePromptsFilterContext();
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
        header: "last updated",
        accessorKey: "lastUpdatedAt",
        cell: TimestampCell,
      },
    ];
    if (canModify) {
      cols.push({
        id: "actions",
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

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      columnPinning: {
        right: ["actions"],
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return <PromptsEmpty />;
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
      <table css={selectableTableCSS} data-testid="prompts-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={
                    header.column.getIsPinned()
                      ? getCommonPinningStyles(header.column)
                      : undefined
                  }
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
                              <Icons.CaretUpFilled />
                            ) : (
                              <Icons.CaretDownFilled />
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
                    style={
                      cell.column.getIsPinned()
                        ? getCommonPinningStyles(cell.column)
                        : undefined
                    }
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
}
