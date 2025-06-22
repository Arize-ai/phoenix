import { useCallback, useMemo, useRef } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Token, View } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { TextCell } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { EditModelButton } from "@phoenix/pages/settings/EditModelButton";
import { getProviderName } from "@phoenix/utils/generativeUtils";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ModelsTable_generativeModel$data,
  ModelsTable_generativeModel$key,
} from "./__generated__/ModelsTable_generativeModel.graphql";
import { ModelsTable_generativeModels$key } from "./__generated__/ModelsTable_generativeModels.graphql";
import { ModelsTableModelsQuery } from "./__generated__/ModelsTableModelsQuery.graphql";
import { CloneModelButton } from "./CloneModelButton";
import { DeleteModelButton } from "./DeleteModelButton";

const PAGE_SIZE = 100;

const GENERATIVE_MODEL_FRAGMENT = graphql`
  fragment ModelsTable_generativeModel on GenerativeModel @inline {
    id
    name
    provider
    namePattern
    providerKey
    startTime
    createdAt
    updatedAt
    lastUsedAt
    kind
    tokenPrices {
      tokenType
      kind
      costPerMillionTokens
      costPerToken
    }
  }
`;

type ModelsTableProps = {
  query: ModelsTable_generativeModels$key;
};

function getRowCost(row: ModelsTable_generativeModel$data, tokenType: string) {
  const cost = row.tokenPrices?.find(
    (entry) => entry.tokenType === tokenType
  )?.costPerMillionTokens;
  return cost != null ? `${costFormatter(cost)}` : "--";
}

export function ModelsTable(props: ModelsTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ModelsTableModelsQuery,
    ModelsTable_generativeModels$key
  >(
    graphql`
      fragment ModelsTable_generativeModels on Query
      @refetchable(queryName: "ModelsTableModelsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        generativeModels(first: $first, after: $after)
          @connection(key: "ModelsTable_generativeModels") {
          __id
          edges {
            node {
              ...ModelsTable_generativeModel
            }
          }
        }
      }
    `,
    props.query
  );

  const connectionId = data.generativeModels.__id;

  const tableData = useMemo(
    () =>
      data.generativeModels.edges.map((edge) => {
        const node = edge.node;
        const data = readInlineData<ModelsTable_generativeModel$key>(
          GENERATIVE_MODEL_FRAGMENT,
          node
        );
        return data;
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
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "name",
        accessorKey: "name",
        size: 300,
        cell: ({ row }) => {
          const model = row.original;
          return (
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              justifyContent="space-between"
            >
              <span>{model.name}</span>
              <View flex="none">
                {row.original.kind === "CUSTOM" ? (
                  <Token>custom</Token>
                ) : (
                  <Token color="var(--ac-global-color-blue-500)">
                    built-in
                  </Token>
                )}
              </View>
            </Flex>
          );
        },
      },
      {
        header: "provider",
        accessorKey: "providerKey",
        cell: ({ row }) => {
          const providerKey = row.original.providerKey;
          if (!providerKey) {
            return <span>{row.original.provider || "--"}</span>;
          }

          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={providerKey} height={18} />
              <span>{getProviderName(providerKey as ModelProvider)}</span>
            </Flex>
          );
        },
      },
      {
        header: "name pattern",
        accessorKey: "namePattern",
        cell: TextCell,
        size: 800,
      },
      {
        header: "input cost",
        accessorKey: "tokenCost.input",
        cell: ({ row }) => {
          return getRowCost(row.original, "input");
        },
      },
      {
        header: "output cost",
        accessorKey: "tokenCost.output",
        cell: ({ row }) => {
          return getRowCost(row.original, "output");
        },
      },
      {
        header: "cache read cost",
        accessorKey: "tokenCost.cacheRead",
        cell: ({ row }) => {
          return getRowCost(row.original, "cacheRead");
        },
      },
      {
        header: "cache write cost",
        accessorKey: "tokenCost.cacheWrite",
        cell: ({ row }) => {
          return getRowCost(row.original, "cacheWrite");
        },
      },
      {
        header: "prompt audio cost",
        accessorKey: "tokenCost.promptAudio",
        cell: ({ row }) => {
          return getRowCost(row.original, "promptAudio");
        },
      },
      {
        header: "completion audio cost",
        accessorKey: "tokenCost.completionAudio",
        cell: ({ row }) => {
          return getRowCost(row.original, "completionAudio");
        },
      },
      {
        header: "reasoning cost",
        accessorKey: "tokenCost.reasoning",
        cell: ({ row }) => {
          return getRowCost(row.original, "reasoning");
        },
      },
      {
        header: "start date",
        accessorKey: "startTime",
        cell: (props) => {
          return (
            <TimestampCell
              {...props}
              format={{
                year: "numeric",
                month: "numeric",
                day: "numeric",
              }}
            />
          );
        },
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
      {
        header: "last used at",
        accessorKey: "lastUsedAt",
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => {
          const isCustomModel = row.original.kind === "CUSTOM";
          return (
            <Flex
              direction="row"
              gap="size-50"
              width="100%"
              justifyContent="end"
            >
              {isCustomModel && (
                <TooltipTrigger>
                  <EditModelButton modelId={row.original.id} />
                  <Tooltip>
                    <TooltipArrow />
                    Edit model
                  </Tooltip>
                </TooltipTrigger>
              )}
              <TooltipTrigger>
                <CloneModelButton
                  modelId={row.original.id}
                  connectionId={connectionId}
                />
                <Tooltip>
                  <TooltipArrow />
                  Clone model
                </Tooltip>
              </TooltipTrigger>
              {isCustomModel && (
                <TooltipTrigger>
                  <DeleteModelButton
                    modelId={row.original.id}
                    modelName={row.original.name}
                    connectionId={connectionId}
                  />
                  <Tooltip>
                    <TooltipArrow />
                    Delete model
                  </Tooltip>
                </TooltipTrigger>
              )}
            </Flex>
          );
        },
      },
    ];
    return cols;
  }, [connectionId]);

  const table = useReactTable({
    columns,
    data: tableData,
    initialState: {
      columnPinning: {
        left: ["name", "provider"],
        right: ["actions"],
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return (
      <div>
        <p>No models found.</p>
      </div>
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
      <table
        css={selectableTableCSS}
        style={{ width: table.getTotalSize(), minWidth: "100%" }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={{
                    ...getCommonPinningStyles(header.column),
                    width: header.column.getSize(),
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort()
                          ? "cursor-pointer"
                          : "",
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
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    align={cell.column.columnDef.meta?.textAlign}
                    style={{
                      ...getCommonPinningStyles(cell.column),
                      width: cell.column.getSize(),
                    }}
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
