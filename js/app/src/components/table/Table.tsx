import type * as TanStack from "@tanstack/react-table";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { Button, Icon, Icons } from "@phoenix/components";

import { paginationCSS, tableCSS } from "./styles";
import { TableEmpty } from "./TableEmpty";

// Unlike the app's other tables this one pages its rows, so it has its own
// feature set rather than `appTableFeatures`.
const paginatedTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

type TableProps<DataRow extends object> = {
  columns: TanStack.ColumnDef<typeof paginatedTableFeatures, DataRow>[];
  data: DataRow[];
};

export function Table<DataRow extends object>({
  columns,
  data,
}: TableProps<DataRow>) {
  const table = useTable({
    features: paginatedTableFeatures,
    columns,
    data,
  });

  const rows = table.getRowModel().rows;
  const hasContent = rows.length > 0;
  const body = hasContent ? (
    <tbody>
      {rows.map((row) => {
        return (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => {
              return (
                <td key={cell.id}>
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
    <>
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {body}
      </table>
      {/*
        TODO(mikeldking): style tables
          This is just a very basic UI implementation
        */}
      <div css={paginationCSS}>
        <Button
          variant="default"
          size="S"
          onPress={table.previousPage}
          isDisabled={!table.getCanPreviousPage()}
          aria-label="Previous Page"
          leadingVisual={<Icon svg={<Icons.ChevronLeft />} />}
        />

        <Button
          size="S"
          onPress={table.nextPage}
          isDisabled={!table.getCanNextPage()}
          aria-label="Next Page"
          leadingVisual={<Icon svg={<Icons.ChevronRight />} />}
        />
      </div>
    </>
  );
}
