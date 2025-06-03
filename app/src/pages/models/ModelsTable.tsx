import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { selectableTableCSS } from "@phoenix/components/table/styles";

// LLM pricing data
const modelPricingData = [
  {
    id: "1",
    model: "gpt-4.1-2025-04-14",
    provider: "openai",
    input: "$0.0000020000",
    output: "$0.0000080000",
    cachedInput: "$0.0000005000",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^gpt-4\\.1-2025-04-14$",
  },
  {
    id: "2",
    model: "gpt-4.1-mini-2025-04-14",
    provider: "openai",
    input: "$0.0000004000",
    output: "$0.0000016000",
    cachedInput: "$0.0000001000",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "override",
    regex: "^gpt-4\\.1-mini-2025-04-14$",
  },
  {
    id: "2a",
    model: "gpt-4.1-mini-2025-04-14",
    provider: "openai",
    input: "$0.0000004000",
    output: "$0.0000016000",
    cachedInput: "$0.0000001000",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^gpt-4\\.1-mini-2025-04-14$",
  },
  {
    id: "3",
    model: "gpt-4o-mini-2024-07-18",
    provider: "openai",
    input: "$0.0000001500",
    output: "$0.0000006000",
    cachedInput: "$0.0000000750",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^gpt-4o-mini-2024-07-18$",
  },
  {
    id: "4",
    model: "claude-3-7-sonnet-latest",
    provider: "anthropic",
    input: "0.000003",
    output: "0.000015",
    cachedInput: null,
    cacheWrite: "0.00000375",
    cacheRead: "0.0000003",
    maintainedBy: "override",
    regex: "^claude-3-7-sonnet-latest$",
  },
  {
    id: "4a",
    model: "claude-3-7-sonnet-latest",
    provider: "anthropic",
    input: "0.000003",
    output: "0.000015",
    cachedInput: null,
    cacheWrite: "0.00000375",
    cacheRead: "0.0000003",
    maintainedBy: "local",
    regex: "^claude-3-7-sonnet-latest$",
  },
  {
    id: "5",
    model: "claude-3-5-haiku-latest",
    provider: "anthropic",
    input: "0.0000008",
    output: "0.000004",
    cachedInput: null,
    cacheWrite: "0.000001",
    cacheRead: "0.00000008",
    maintainedBy: "local",
    regex: "^claude-3-5-haiku-latest$",
  },
  {
    id: "6",
    model: "anthropic.claude-3-opus-20240229-v1:0",
    provider: "bedrock",
    input: "0.000015",
    output: "0.000075",
    cachedInput: null,
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "override",
    regex: "^claude-3-opus-\\d{8}-v1:0$",
  },
  {
    id: "6a",
    model: "anthropic.claude-3-opus-20240229-v1:0",
    provider: "bedrock",
    input: "0.000015",
    output: "0.000075",
    cachedInput: null,
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^claude-3-opus-\\d{8}-v1:0$",
  },
  {
    id: "7",
    model: "Llama 3.3 Instruct (70B)",
    provider: "bedrock",
    input: "0.00000072",
    output: "0.00000072",
    cachedInput: null,
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^Llama 3\\.3 Instruct \\(70B\\)$",
  },
  {
    id: "8",
    model: "o1-2024-12-17",
    provider: "openai",
    input: "$0.0000150000",
    output: "$0.0000600000",
    cachedInput: "$0.0000075000",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "override",
    regex: "^o1-2024-12-17$",
  },
  {
    id: "8a",
    model: "o1-2024-12-17",
    provider: "openai",
    input: "$0.0000150000",
    output: "$0.0000600000",
    cachedInput: "$0.0000075000",
    cacheWrite: null,
    cacheRead: null,
    maintainedBy: "local",
    regex: "^o1-2024-12-17$",
  },
];

const handleEditModelConfig = (_modelId: string, _modelName: string) => {
  // TODO: Implement edit model config functionality
  // This could open a modal, navigate to an edit page, etc.
};

export function ModelsTable() {
  type TableRow = (typeof modelPricingData)[number];

  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "Model",
        accessorKey: "model",
      },
      {
        header: "Regex",
        accessorKey: "regex",
      },
      {
        header: "Provider",
        accessorKey: "provider",
      },
      {
        header: "Maintained By",
        accessorKey: "maintainedBy",
      },
      {
        header: "Input Cost",
        accessorKey: "input",
      },
      {
        header: "Output Cost",
        accessorKey: "output",
      },
      {
        header: "Cached Input",
        accessorKey: "cachedInput",
      },
      {
        header: "Cache Write",
        accessorKey: "cacheWrite",
      },
      {
        header: "Cache Read",
        accessorKey: "cacheRead",
      },
      {
        id: "actions",
        header: "Actions",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => (
          <Flex justifyContent="end" width="100%">
            <Button
              size="S"
              variant="default"
              leadingVisual={<Icon svg={<Icons.EditOutline />} />}
              onPress={() =>
                handleEditModelConfig(row.original.id, row.original.model)
              }
            >
              Edit
            </Button>
          </Flex>
        ),
      },
    ];
    return cols;
  }, []);

  const table = useReactTable({
    columns,
    data: modelPricingData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
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
