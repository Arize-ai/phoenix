import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button, Icon, Icons } from "@phoenix/components";

import { paginationCSS, tableCSS } from "./styles";
import { TableEmpty } from "./TableEmpty";

type TableProps<DataRow extends object> = {
  columns: ColumnDef<DataRow>[];
  data: DataRow[];
};

export function Table<DataRow extends object>({
  columns,
  data,
}: TableProps<DataRow>) {
  const table = useReactTable<DataRow>({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const hasContent = rows.length > 0;
  const body = hasContent ? (
    <tbody>
      {rows.map((row) => {
        return (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
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
          leadingVisual={<Icon svg={<Icons.ArrowIosBackOutline />} />}
        />

        <Button
          size="S"
          onPress={table.nextPage}
          isDisabled={!table.getCanNextPage()}
          aria-label="Next Page"
          leadingVisual={<Icon svg={<Icons.ArrowIosForwardOutline />} />}
        />
      </div>
    </>
  );
}
