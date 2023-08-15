import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css, Theme } from "@emotion/react";

import { Button, Icon, Icons } from "@arizeai/components";

import { tableCSS } from "./styles";

const paginationCSS = (theme: Theme) => css`
  display: flex;
  justify-content: flex-end;
  padding: ${theme.spacing.margin8}px;
  gap: ${theme.spacing.margin4}px;
  border-top: 1px solid ${theme.colors.gray500};
`;

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
          size="compact"
          onClick={table.previousPage}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous Page"
          icon={<Icon svg={<Icons.ArrowIosBackOutline />} />}
        />

        <Button
          variant="default"
          size="compact"
          onClick={table.nextPage}
          disabled={!table.getCanNextPage()}
          aria-label="Next Page"
          icon={<Icon svg={<Icons.ArrowIosForwardOutline />} />}
        />
      </div>
    </>
  );
}

function TableEmpty() {
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={(theme) => css`
            text-align: center;
            padding: ${theme.spacing.margin24}px ${theme.spacing.margin24}px !important;
          `}
        >
          No data
        </td>
      </tr>
    </tbody>
  );
}
