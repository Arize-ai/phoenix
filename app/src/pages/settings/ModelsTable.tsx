import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingFn,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Token, View } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { TextCell } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import {
  DEFAULT_FORMAT,
  TimestampCell,
} from "@phoenix/components/table/TimestampCell";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  GenerativeModelKind,
  ModelsTable_generativeModels$data,
  ModelsTable_generativeModels$key,
} from "@phoenix/pages/settings/__generated__/ModelsTable_generativeModels.graphql";
import { EditModelButton } from "@phoenix/pages/settings/EditModelButton";
import { Mutable } from "@phoenix/typeUtils";
import { getProviderName } from "@phoenix/utils/generativeUtils";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import { CloneModelButton } from "./CloneModelButton";
import { DeleteModelButton } from "./DeleteModelButton";

type ModelsTableProps = {
  modelsRef: ModelsTable_generativeModels$key;
  kindFilter: "ALL" | GenerativeModelKind;
  search: string;
};

function filterableDateAccessorFn(row?: string | null | undefined) {
  return row != null
    ? new Date(row).toLocaleString([], DEFAULT_FORMAT)
    : undefined;
}

function getRowCostNumber(
  row: ModelsTable_generativeModels$data["generativeModels"][number],
  tokenType: string
) {
  const cost = row.tokenPrices?.find(
    (entry) => entry.tokenType === tokenType
  )?.costPerMillionTokens;
  return cost;
}

function getRowCost(
  row: ModelsTable_generativeModels$data["generativeModels"][number],
  tokenType: string
) {
  const cost = getRowCostNumber(row, tokenType);
  return cost != null ? `${costFormatter(cost)}` : "--";
}

const sortCostColumnFn: SortingFn<
  ModelsTable_generativeModels$data["generativeModels"][number]
> = (rowA, rowB, columnId) => {
  const costA = getRowCostNumber(rowA.original, columnId);
  const costB = getRowCostNumber(rowB.original, columnId);
  if (costA == null || costB == null) {
    return 0;
  }
  return costA - costB;
};

const makeCostColumn = (tokenType: string, header: string) => {
  return {
    header,
    id: tokenType,
    accessorFn: (row) => getRowCost(row, tokenType),
    sortingFn: sortCostColumnFn,
    sortUndefined: "last",
    cell: ({ row }) => {
      return getRowCost(row.original, tokenType);
    },
  } satisfies ColumnDef<
    ModelsTable_generativeModels$data["generativeModels"][number]
  >;
};

export function ModelsTable({
  modelsRef,
  kindFilter,
  search,
}: ModelsTableProps) {
  const data = useFragment(
    graphql`
      fragment ModelsTable_generativeModels on Query {
        generativeModels {
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
      }
    `,
    modelsRef
  );

  const generativeModels = data.generativeModels;

  const tableData = useMemo(
    () => (generativeModels ?? []) as Mutable<typeof generativeModels>,
    [generativeModels]
  );

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols = [
      // invisible column for filtering purposes
      {
        id: "kind",
        enableHiding: true,
        accessorFn: (row) => row.kind,
      },
      {
        header: "name",
        accessorKey: "name",
        minSize: 300,
        cell: ({ row }) => {
          const model = row.original;
          return (
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              justifyContent="space-between"
            >
              <Truncate maxWidth="100%" title={model.name}>
                {model.name}
              </Truncate>
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
        accessorFn: (row) => row.providerKey ?? undefined,
        sortUndefined: "last",
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
      },
      makeCostColumn("input", "input cost"),
      makeCostColumn("output", "output cost"),
      makeCostColumn("cacheRead", "cache read cost"),
      makeCostColumn("cacheWrite", "cache write cost"),
      makeCostColumn("promptAudio", "prompt audio cost"),
      makeCostColumn("completionAudio", "completion audio cost"),
      makeCostColumn("reasoning", "reasoning cost"),
      {
        header: "start date",
        // move null values to the end of the list
        sortUndefined: "last",
        // tanstack table doesn't know how to sort null values, so we need to coalesce to undefined
        accessorFn: (row) => filterableDateAccessorFn(row.startTime),
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
        accessorFn: (row) => filterableDateAccessorFn(row.createdAt),
        sortUndefined: "last",
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorFn: (row) => filterableDateAccessorFn(row.updatedAt),
        sortUndefined: "last",
        cell: TimestampCell,
      },
      {
        header: "last used at",
        accessorFn: (row) => filterableDateAccessorFn(row.lastUsedAt),
        sortUndefined: "last",
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
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
                <CloneModelButton modelId={row.original.id} />
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
    ] satisfies ColumnDef<TableRow>[];
    return cols;
  }, []);

  // if this is not memoized, the table will get into an infinite loop
  const columnFilters = useMemo(() => {
    return [
      {
        id: "kind",
        value: kindFilter === "ALL" ? "" : kindFilter,
      },
    ];
  }, [kindFilter]);

  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      columnVisibility: {
        kind: false,
      },
      columnPinning: {
        left: ["name", "provider"],
        right: ["actions"],
      },
      globalFilter: search?.trim(),
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return (
      <Flex width="100%" justifyContent="center" alignItems="center">
        <p>No models found</p>
      </Flex>
    );
  }

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
    >
      <table
        css={tableCSS}
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
                    boxSizing: "border-box",
                    minWidth: header.column.getSize(),
                    maxWidth: header.column.getSize(),
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort() ? "sort" : "",
                        onClick: header.column.getToggleSortingHandler(),
                        style: {
                          textWrap: "nowrap",
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
