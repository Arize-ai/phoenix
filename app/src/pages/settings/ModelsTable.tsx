import { useMemo } from "react";
import { Focusable } from "react-aria";
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

import {
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Token,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import {
  DEFAULT_FORMAT,
  TimestampCell,
} from "@phoenix/components/table/TimestampCell";
import {
  RichTooltip,
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

/**
 * Converts a date into a user search-able string, or undefined, so that tanstack table can filter on it
 * @param row - the row to get the date from
 * @returns the date, as a string, in the format of the DEFAULT_FORMAT
 */
function filterableDateAccessorFn(row?: string | null | undefined) {
  return row != null
    ? new Date(row).toLocaleString([], DEFAULT_FORMAT)
    : undefined;
}

/**
 * Gets the cost of a row for a given token type as a number, or undefined
 * @param row - the row to get the cost from
 * @param tokenType - the token type to get the cost for
 * @returns the cost of the row for the given token type
 */
function getRowCostNumber(
  row: ModelsTable_generativeModels$data["generativeModels"][number],
  tokenType: string
) {
  const cost = row.tokenPrices?.find(
    (entry) => entry.tokenType === tokenType
  )?.costPerMillionTokens;
  return cost;
}

/**
 * Gets the cost of a row for a given token type as a string, or "--" if the cost is undefined
 * @param row - the row to get the cost from
 * @param tokenType - the token type to get the cost for
 * @returns the cost of the row for the given token type
 */
function getRowCost(
  row: ModelsTable_generativeModels$data["generativeModels"][number],
  tokenType: string
) {
  const cost = getRowCostNumber(row, tokenType);
  return cost != null ? `${costFormatter(cost)}` : "--";
}

/**
 * Sorts a row by the cost of a given token type, ignoring the user-visible cost string during sort
 *
 * undefined values will float to the bottom.
 *
 * @param rowA - the first row to sort
 * @param rowB - the second row to sort
 * @param columnId - the id of the column to sort by
 * @returns the difference between the costs of the two rows
 */
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
        accessorFn: (row) => row.provider ?? undefined,
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
        header: "match pattern",
        accessorKey: "namePattern",
        cell: ({ row }) => {
          const namePattern = row.original.namePattern;
          const provider = row.original.providerKey;
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <span>
                <Truncate maxWidth="100%" title={namePattern}>
                  {namePattern}
                </Truncate>
              </span>
              {provider && (
                <TooltipTrigger delay={0}>
                  <Focusable>
                    <Token
                      role="button"
                      color="var(--ac-global-color-grey-300)"
                    >
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <GenerativeProviderIcon
                          provider={provider}
                          height={18}
                        />
                        <span>{getProviderName(provider)}</span>
                      </Flex>
                    </Token>
                  </Focusable>
                  <Tooltip>
                    <TooltipArrow />
                    The preceding name pattern match will only be applied on
                    incoming traces with {getProviderName(provider)} set as the
                    provider.
                  </Tooltip>
                </TooltipTrigger>
              )}
            </Flex>
          );
        },
      },
      {
        header: "prompt cost",
        id: "input",
        accessorFn: (row) => getRowCost(row, "input"),
        meta: { textAlign: "right" },
        sortingFn: sortCostColumnFn,
        sortUndefined: "last",
        cell: ({ row }) => {
          const inputCost = getRowCost(row.original, "input");
          return (
            <Flex justifyContent="end" alignItems="center" gap="size-100">
              <span>{inputCost}</span>
              <TooltipTrigger delay={0}>
                <IconButton size="S" aria-label="Input cost details">
                  <Icon svg={<Icons.MoreHorizontalOutline />} />
                </IconButton>
                <RichTooltip>
                  <TooltipArrow />
                  <Heading level={4} weight="heavy">
                    Input Cost Breakdown
                  </Heading>
                  <View paddingTop="size-100">
                    {row.original.tokenPrices
                      ?.filter((entry) => entry.kind === "PROMPT")
                      .map((entry) => (
                        <Flex
                          key={entry.tokenType}
                          direction="row"
                          gap="size-100"
                          justifyContent="space-between"
                          width="100%"
                        >
                          <span>{entry.tokenType.toLocaleLowerCase()}</span>
                          <span>
                            {entry.costPerMillionTokens != null
                              ? `${costFormatter(entry.costPerMillionTokens)} / 1M`
                              : "--"}
                          </span>
                        </Flex>
                      )) ?? null}
                  </View>
                </RichTooltip>
              </TooltipTrigger>
            </Flex>
          );
        },
      },
      {
        header: "completion cost",
        id: "output",
        accessorFn: (row) => getRowCost(row, "output"),
        meta: { textAlign: "right" },
        sortingFn: sortCostColumnFn,
        sortUndefined: "last",
        cell: ({ row }) => {
          const outputCost = getRowCost(row.original, "output");
          return (
            <Flex justifyContent="end" alignItems="center" gap="size-100">
              <span>{outputCost}</span>
              <TooltipTrigger delay={0}>
                <IconButton size="S" aria-label="Output cost details">
                  <Icon svg={<Icons.MoreHorizontalOutline />} />
                </IconButton>
                <RichTooltip>
                  <TooltipArrow />
                  <Heading level={4} weight="heavy">
                    Output Cost Breakdown
                  </Heading>
                  <View paddingTop="size-100">
                    {row.original.tokenPrices
                      ?.filter((entry) => entry.kind === "COMPLETION")
                      .map((entry) => (
                        <Flex
                          key={entry.tokenType}
                          direction="row"
                          gap="size-100"
                          justifyContent="space-between"
                          width="100%"
                        >
                          <span>{entry.tokenType.toLocaleLowerCase()}</span>
                          <span>
                            {entry.costPerMillionTokens != null
                              ? `${costFormatter(entry.costPerMillionTokens)} / 1M`
                              : "--"}
                          </span>
                        </Flex>
                      )) ?? null}
                  </View>
                </RichTooltip>
              </TooltipTrigger>
            </Flex>
          );
        },
      },
      {
        header: "start date",
        sortUndefined: "last",
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
        provider: false,
      },
      columnPinning: {
        left: ["name"],
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
