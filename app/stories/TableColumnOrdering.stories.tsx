import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import { Checkbox, Flex, Text, View } from "@phoenix/components";
import {
  ColumnHeaderCell,
  ColumnOrderingProvider,
  ColumnSelector,
  ColumnSelectorMenu,
  getColumnDefId,
  getTopLevelColumnIds,
  useColumnOrder,
} from "@phoenix/components/table";

import { tableCSS } from "../src/components/table/styles";

type Person = {
  id: string;
  name: string;
  email: string;
  department: string;
  age: number;
  salary: number;
  bonus: number;
  status: "active" | "inactive";
};

const mockPeople: Person[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    department: "Engineering",
    age: 30,
    salary: 75000,
    bonus: 5000,
    status: "active",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    department: "Design",
    age: 28,
    salary: 82000,
    bonus: 8000,
    status: "active",
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob.johnson@example.com",
    department: "Marketing",
    age: 35,
    salary: 68000,
    bonus: 2000,
    status: "inactive",
  },
  {
    id: "4",
    name: "Alice Williams",
    email: "alice.williams@example.com",
    department: "Engineering",
    age: 32,
    salary: 95000,
    bonus: 12000,
    status: "active",
  },
  {
    id: "5",
    name: "Charlie Brown",
    email: "charlie.brown@example.com",
    department: "Management",
    age: 45,
    salary: 120000,
    bonus: 20000,
    status: "active",
  },
];

const baseColumns: ColumnDef<Person>[] = [
  { header: "name", accessorKey: "name" },
  { header: "email", accessorKey: "email" },
  { header: "department", accessorKey: "department" },
  { header: "age", accessorKey: "age" },
  { header: "salary", accessorKey: "salary" },
  { header: "status", accessorKey: "status" },
];

const groupedColumns: ColumnDef<Person>[] = [
  { header: "name", accessorKey: "name" },
  { header: "email", accessorKey: "email" },
  { header: "department", accessorKey: "department" },
  {
    header: "compensation",
    columns: [
      { header: "salary", accessorKey: "salary" },
      { header: "bonus", accessorKey: "bonus" },
    ],
  },
  { header: "status", accessorKey: "status" },
];

function getColumnLabel(def: ColumnDef<Person>): string {
  return typeof def.header === "string"
    ? def.header
    : (getColumnDefId(def) ?? "");
}

/** A table whose columns can be reordered and shown/hidden via drag or the column selector. */
function ReorderableTable({
  columns,
  withSelector = true,
}: {
  columns: ColumnDef<Person>[];
  withSelector?: boolean;
}) {
  "use no memo";
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    getTopLevelColumnIds(columns)
  );
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});

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
  });

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<Person>({
    columns,
    data: mockPeople,
    state: {
      columnOrder: leafColumnOrder,
      columnVisibility,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const selectorColumns = columnOrder.flatMap((id) => {
    const def = columns.find((def) => getColumnDefId(def) === id);
    // Group columns are reorderable from the header but not selectable
    if (def == null || ("columns" in def && def.columns != null)) {
      return [];
    }
    return [{ id, label: getColumnLabel(def) }];
  });

  return (
    <Flex direction="column" gap="size-100" alignItems="start">
      {withSelector ? (
        <ColumnSelector
          columns={selectorColumns}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          onColumnOrderChange={setColumnOrder}
        />
      ) : null}
      <ColumnOrderingProvider
        columnOrder={visibleColumnOrder}
        onColumnOrderChange={onVisibleColumnOrderChange}
      >
        <table css={tableCSS}>
          <thead>
            {table.getHeaderGroups().map((headerGroup, headerGroupIndex) => (
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
                    colSpan={header.colSpan}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </ColumnHeaderCell>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ColumnOrderingProvider>
    </Flex>
  );
}

const meta: Meta = {
  title: "Table/ColumnOrdering",
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj;

/** Drag headers to reorder columns; the selector supports search, show/hide, and reordering. */
export const Default: Story = {
  render: () => <ReorderableTable columns={baseColumns} />,
};

/**
 * Group columns (two header rows) move as a contiguous block when dragged.
 */
export const WithGroupedColumns: Story = {
  render: () => <ReorderableTable columns={groupedColumns} />,
};

/**
 * Headers are draggable even without the column selector.
 */
export const HeadersOnly: Story = {
  render: () => <ReorderableTable columns={baseColumns} withSelector={false} />,
};

/** The column selector menu with extra, non-reorderable sections appended below the column list. */
export const SelectorMenuWithSections: Story = {
  render: function SelectorMenuWithSectionsStory() {
    const [columnOrder, setColumnOrder] = useState<string[]>(() =>
      getTopLevelColumnIds(baseColumns)
    );
    const [columnVisibility, setColumnVisibility] = useState<
      Record<string, boolean>
    >({});
    const [annotations, setAnnotations] = useState<Record<string, boolean>>({
      correctness: true,
      hallucination: false,
      relevance: false,
    });
    const selectorColumns = columnOrder.flatMap((id) => {
      const def = baseColumns.find((def) => getColumnDefId(def) === id);
      return def ? [{ id, label: getColumnLabel(def) }] : [];
    });
    return (
      <View
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        width="260px"
      >
        <ColumnSelectorMenu
          columns={selectorColumns}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          onColumnOrderChange={setColumnOrder}
        >
          <section
            css={css`
              padding: 0 var(--global-dimension-size-50);
              margin-top: var(--global-dimension-size-50);
              border-top: 1px solid var(--global-border-color-default);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                min-height: var(--global-dimension-size-400);
                padding: 0 var(--global-dimension-size-100);
                margin-top: var(--global-dimension-size-50);
                border-radius: var(--global-rounding-small);
                &:hover {
                  background-color: var(--global-color-gray-200);
                }
              `}
            >
              <Checkbox
                name="toggle-annotations"
                isSelected={Object.values(annotations).every(Boolean)}
                isIndeterminate={
                  Object.values(annotations).some(Boolean) &&
                  !Object.values(annotations).every(Boolean)
                }
                onChange={(isSelected) =>
                  setAnnotations((prev) =>
                    Object.fromEntries(
                      Object.keys(prev).map((key) => [key, isSelected])
                    )
                  )
                }
              >
                annotations
              </Checkbox>
            </div>
            <ul
              css={css`
                list-style: none;
                margin: 0;
                padding: 0;
              `}
            >
              {Object.entries(annotations).map(([name, isVisible]) => (
                <li
                  key={name}
                  css={css`
                    display: flex;
                    align-items: center;
                    min-height: var(--global-dimension-size-400);
                    padding: 0 var(--global-dimension-size-100);
                    border-radius: var(--global-rounding-small);
                    &:hover {
                      background-color: var(--global-color-gray-200);
                    }
                  `}
                >
                  <Checkbox
                    name={name}
                    isSelected={isVisible}
                    onChange={(isSelected) =>
                      setAnnotations((prev) => ({
                        ...prev,
                        [name]: isSelected,
                      }))
                    }
                  >
                    {name}
                  </Checkbox>
                </li>
              ))}
            </ul>
          </section>
        </ColumnSelectorMenu>
      </View>
    );
  },
};

/**
 * The column selector menu rendered standalone (outside of a popover).
 */
export const SelectorMenu: Story = {
  render: function SelectorMenuStory() {
    const [columnOrder, setColumnOrder] = useState<string[]>(() =>
      getTopLevelColumnIds(baseColumns)
    );
    const [columnVisibility, setColumnVisibility] = useState<
      Record<string, boolean>
    >({ age: false });
    const selectorColumns = columnOrder.flatMap((id) => {
      const def = baseColumns.find((def) => getColumnDefId(def) === id);
      return def ? [{ id, label: getColumnLabel(def) }] : [];
    });
    return (
      <Flex direction="row" gap="size-200" alignItems="start">
        <View borderColor="default" borderWidth="thin" borderRadius="medium">
          <ColumnSelectorMenu
            columns={selectorColumns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            onColumnOrderChange={setColumnOrder}
          />
        </View>
        <View padding="size-100">
          <Text>Order: {columnOrder.join(", ")}</Text>
        </View>
      </Flex>
    );
  },
};
