import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef, ExpandedState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useRef, useState } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  createRowExpandColumn,
  EXPAND_COLUMN_PINNING,
  RowDetailsRow,
} from "@phoenix/components/table";
import { useDimensions } from "@phoenix/hooks";

import {
  getCommonPinningStyles,
  rowDetailsTableCSS,
  selectableTableCSS,
} from "../src/components/table/styles";

type Person = {
  id: string;
  name: string;
  team: string;
  role: string;
  notes: string;
};

const PEOPLE: Person[] = [
  {
    id: "1",
    name: "John Doe",
    team: "Engineering",
    role: "Staff engineer",
    notes:
      "The detail area takes as much room as its content needs, so the row above can stay a single scannable line.",
  },
  {
    id: "2",
    name: "Jane Smith",
    team: "Design",
    role: "Design lead",
    notes: "Short detail.",
  },
  {
    id: "3",
    name: "Bob Johnson",
    team: "Marketing",
    role: "Content strategist",
    notes:
      "Long unbroken values wrap rather than widening the row: 01JQK7ZC4V8W6R2H9NDXAB3TFY-01JQK7ZC4V8W6R2H9NDXAB3TFY.",
  },
];

const columns: ColumnDef<Person>[] = [
  createRowExpandColumn<Person>({ getRowLabel: (row) => row.original.name }),
  { header: "name", accessorKey: "name" },
  { header: "team", accessorKey: "team" },
  { header: "role", accessorKey: "role" },
];

const tableWithRowDetailsCSS = css(selectableTableCSS, rowDetailsTableCSS);

const scrollPortCSS = css`
  overflow: auto;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

/**
 * A table whose every row reveals a detail area inline, wired up the way the
 * datasets table does it: a pinned disclosure column, expansion keyed by row id,
 * and the detail area sized to the scroll port.
 */
function TableWithRowDetails({ columnWidth = 160 }: { columnWidth?: number }) {
  "use no memo";
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const scrollPortRef = useRef<HTMLDivElement>(null);
  const scrollPortDimensions = useDimensions(scrollPortRef);
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<Person>({
    columns,
    data: PEOPLE,
    defaultColumn: { size: columnWidth },
    state: { expanded, columnPinning: EXPAND_COLUMN_PINNING },
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getRowId: (row) => row.id,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
  });
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  return (
    <div css={scrollPortCSS} ref={scrollPortRef}>
      <table
        css={tableWithRowDetailsCSS}
        style={{ width: table.getTotalSize(), minWidth: "100%" }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={getCommonPinningStyles(header.column)}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isExpanded = row.getIsExpanded();
            return (
              <Fragment key={row.id}>
                <tr data-expanded={isExpanded}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={getCommonPinningStyles(cell.column)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
                {isExpanded ? (
                  <RowDetailsRow
                    rowId={row.id}
                    colSpan={visibleColumnCount}
                    scrollPortWidth={scrollPortDimensions?.width}
                  >
                    <Flex direction="column" gap="size-50">
                      <Text size="XS" color="text-700">
                        Notes
                      </Text>
                      <Text>{row.original.notes}</Text>
                    </Flex>
                  </RowDetailsRow>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const meta: Meta = {
  title: "Table/RowDetails",
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj;

/**
 * Click a chevron — or focus it and press Enter — to reveal that row's detail
 * area inline beneath it. The chevron carries `aria-expanded`, so the state is
 * available to assistive technology as well as to the eye.
 */
export const Default: Story = {
  render: () => <TableWithRowDetails />,
};

/**
 * With columns wider than the viewport, the detail area stays pinned to the
 * leading edge of the scroll port as the table is scrolled sideways, rather than
 * running off with the columns.
 */
export const HorizontallyScrolled: Story = {
  render: () => <TableWithRowDetails columnWidth={400} />,
};
