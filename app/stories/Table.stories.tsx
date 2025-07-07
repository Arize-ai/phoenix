import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ColumnDef,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  RowSelectionState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@phoenix/components";
import { FloatCell, IntCell, TextCell } from "@phoenix/components/table";
import { CellTop } from "@phoenix/components/table/CellTop";

import {
  borderedTableCSS,
  interactiveTableCSS,
  paginationCSS,
  selectableTableCSS,
  tableCSS,
} from "../src/components/table/styles";
import { TableEmpty } from "../src/components/table/TableEmpty";

// Mock data types
type Person = {
  id: string;
  name: string;
  age: number;
  email: string;
  salary: number;
  status: "active" | "inactive";
  department: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  rating: number;
};

// Mock data
const mockPeople: Person[] = [
  {
    id: "1",
    name: "John Doe",
    age: 30,
    email: "john.doe@example.com",
    salary: 75000,
    status: "active",
    department: "Engineering",
  },
  {
    id: "2",
    name: "Jane Smith",
    age: 28,
    email: "jane.smith@example.com",
    salary: 82000,
    status: "active",
    department: "Design",
  },
  {
    id: "3",
    name: "Bob Johnson",
    age: 35,
    email: "bob.johnson@example.com",
    salary: 68000,
    status: "inactive",
    department: "Marketing",
  },
  {
    id: "4",
    name: "Alice Williams",
    age: 32,
    email: "alice.williams@example.com",
    salary: 95000,
    status: "active",
    department: "Engineering",
  },
  {
    id: "5",
    name: "Charlie Brown",
    age: 45,
    email: "charlie.brown@example.com",
    salary: 120000,
    status: "active",
    department: "Management",
  },
];

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Laptop Pro",
    price: 1299.99,
    category: "Electronics",
    inStock: true,
    rating: 4.5,
  },
  {
    id: "2",
    name: "Wireless Mouse",
    price: 29.99,
    category: "Electronics",
    inStock: true,
    rating: 4.2,
  },
  {
    id: "3",
    name: "Office Chair",
    price: 299.99,
    category: "Furniture",
    inStock: false,
    rating: 4.7,
  },
  {
    id: "4",
    name: "Desk Lamp",
    price: 79.99,
    category: "Furniture",
    inStock: true,
    rating: 4.0,
  },
];

// Base Table Component
function BaseTable<T>({
  columns,
  data,
  variant = "basic",
  enableResizing = true,
  enableSorting = true,
  enablePagination = true,
  pageSize = 10,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  variant?: "basic" | "bordered" | "interactive" | "selectable";
  enableResizing?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
}) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable<T>({
    columns,
    data,
    state: {
      columnSizing,
      sorting,
      rowSelection,
    },
    columnResizeMode: enableResizing ? "onChange" : undefined,
    manualSorting: false,
    enableRowSelection: variant === "selectable",
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Get table CSS based on variant
  const getTableCSS = () => {
    switch (variant) {
      case "bordered":
        return css(tableCSS, borderedTableCSS);
      case "interactive":
        return css(tableCSS, interactiveTableCSS);
      case "selectable":
        return selectableTableCSS;
      default:
        return tableCSS;
    }
  };

  const rows = table.getRowModel().rows;
  const hasContent = rows.length > 0;

  // Performance optimization for column sizing
  const [columnSizeVars] = useState(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  });

  const body = hasContent ? (
    <tbody>
      {rows.map((row) => {
        return (
          <tr key={row.id} data-selected={row.getIsSelected()}>
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  style={{
                    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  ) : (
    <TableEmpty />
  );

  return (
    <div
      css={css`
        border: 1px solid var(--ac-global-border-color-default);
        border-radius: var(--ac-global-rounding-small);
        overflow: hidden;
      `}
    >
      <table
        css={getTableCSS()}
        style={{
          ...columnSizeVars,
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={{
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <>
                      <div
                        {...{
                          className:
                            header.column.getCanSort() && enableSorting
                              ? "sort"
                              : "",
                          onClick: enableSorting
                            ? header.column.getToggleSortingHandler()
                            : undefined,
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
                      {enableResizing && (
                        <div
                          {...{
                            onMouseDown: header.getResizeHandler(),
                            onTouchStart: header.getResizeHandler(),
                            className: `resizer ${
                              header.column.getIsResizing() ? "isResizing" : ""
                            }`,
                          }}
                        />
                      )}
                    </>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {body}
      </table>
      {enablePagination && (
        <div css={paginationCSS}>
          <Button
            variant="default"
            size="S"
            onPress={() => {
              table.previousPage();
            }}
            isDisabled={!table.getCanPreviousPage()}
            aria-label="Previous Page"
            leadingVisual={<Icon svg={<Icons.ArrowIosBackOutline />} />}
          />
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            size="S"
            onPress={() => {
              table.nextPage();
            }}
            isDisabled={!table.getCanNextPage()}
            aria-label="Next Page"
            leadingVisual={<Icon svg={<Icons.ArrowIosForwardOutline />} />}
          />
        </div>
      )}
    </div>
  );
}

// Column definitions
const personColumns: ColumnDef<Person>[] = [
  {
    header: "Name",
    accessorKey: "name",
    size: 200,
    cell: ({ getValue }) => <strong>{getValue() as string}</strong>,
  },
  {
    header: "Age",
    accessorKey: "age",
    size: 80,
    cell: IntCell,
  },
  {
    header: "Email",
    accessorKey: "email",
    size: 250,
    cell: TextCell,
  },
  {
    header: "Salary",
    accessorKey: "salary",
    size: 120,
    cell: ({ getValue }) => `$${(getValue() as number).toLocaleString()}`,
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    cell: ({ getValue }) => {
      const status = getValue() as string;
      return (
        <span
          css={css`
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background-color: ${status === "active"
              ? "var(--ac-global-color-success-100)"
              : "var(--ac-global-color-grey-100)"};
            color: ${status === "active"
              ? "var(--ac-global-color-success-900)"
              : "var(--ac-global-color-grey-700)"};
          `}
        >
          {status}
        </span>
      );
    },
  },
  {
    header: "Department",
    accessorKey: "department",
    size: 150,
    cell: TextCell,
  },
];

const productColumns: ColumnDef<Product>[] = [
  {
    header: "Product",
    accessorKey: "name",
    size: 200,
    cell: ({ getValue }) => <strong>{getValue() as string}</strong>,
  },
  {
    header: "Price",
    accessorKey: "price",
    size: 100,
    cell: FloatCell,
  },
  {
    header: "Category",
    accessorKey: "category",
    size: 120,
    cell: TextCell,
  },
  {
    header: "In Stock",
    accessorKey: "inStock",
    size: 100,
    cell: ({ getValue }) => (getValue() ? "✅ Yes" : "❌ No"),
  },
  {
    header: "Rating",
    accessorKey: "rating",
    size: 100,
    cell: ({ getValue }) => `⭐ ${getValue()}`,
  },
];

// Story Components
const PersonTable = (props: {
  variant?: "basic" | "bordered" | "interactive" | "selectable";
  enableResizing?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  data?: Person[];
}) => (
  <BaseTable
    columns={personColumns}
    data={props.data || mockPeople}
    variant={props.variant}
    enableResizing={props.enableResizing}
    enableSorting={props.enableSorting}
    enablePagination={props.enablePagination}
    pageSize={props.pageSize}
  />
);

const ProductTable = (props: {
  variant?: "basic" | "bordered" | "interactive" | "selectable";
  enableResizing?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  data?: Product[];
}) => (
  <BaseTable
    columns={productColumns}
    data={props.data || mockProducts}
    variant={props.variant}
    enableResizing={props.enableResizing}
    enableSorting={props.enableSorting}
    enablePagination={props.enablePagination}
    pageSize={props.pageSize}
  />
);

const meta: Meta<typeof PersonTable> = {
  title: "Components/Table",
  component: PersonTable,
  parameters: {
    docs: {
      description: {
        component: `
A flexible table component built with TanStack Table that supports:
- **Column Resizing**: Drag column borders to resize
- **Sorting**: Click column headers to sort data
- **Pagination**: Navigate through large datasets
- **Row Selection**: Select rows for bulk actions
- **Multiple Variants**: Basic, bordered, interactive, and selectable styles
- **Performance Optimized**: Uses CSS variables for efficient column sizing

The table automatically handles empty states and provides a consistent API for different data types.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["basic", "bordered", "interactive", "selectable"],
      description: "Visual style variant of the table",
    },
    enableResizing: {
      control: { type: "boolean" },
      description: "Enable column resizing by dragging column borders",
    },
    enableSorting: {
      control: { type: "boolean" },
      description: "Enable sorting by clicking column headers",
    },
    enablePagination: {
      control: { type: "boolean" },
      description: "Enable pagination controls",
    },
    pageSize: {
      control: { type: "number", min: 1, max: 20 },
      description: "Number of rows per page",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PersonTable>;

/**
 * Basic table with minimal styling and resizable columns.
 * Drag the column borders to resize columns.
 */
export const Basic: Story = {
  args: {
    variant: "basic",
    enableResizing: true,
    enableSorting: true,
    enablePagination: true,
    pageSize: 10,
  },
};

/**
 * Interactive table with hover effects on rows.
 * Rows highlight when hovered.
 */
export const Interactive = {
  render: () => (
    <ProductTable
      variant="interactive"
      enableResizing={true}
      enableSorting={true}
      enablePagination={false}
    />
  ),
};

/**
 * Table with no data to demonstrate empty state.
 */
export const Empty: Story = {
  args: {
    variant: "basic",
    enableResizing: true,
    enableSorting: true,
    enablePagination: true,
    pageSize: 10,
    data: [],
  },
};
