import React from "react";
import { useTable, usePagination, Column } from "react-table";
import { css, Theme } from "@emotion/react";
import { Button, Icon, Icons } from "@arizeai/components";

const tableCSS = (theme: Theme) => css`
  font-size: ${theme.typography.sizes.medium.fontSize}px;
  width: 100%;
  border-collapse: collapse;
  thead {
    background-color: ${theme.colors.gray500};
    tr {
      th {
        padding: ${theme.spacing.margin4}px ${theme.spacing.margin16}px;
        text-align: left;
      }
    }
  }
  tbody {
    tr {
      &:nth-of-type(even) {
        background-color: ${theme.colors.gray700};
      }
      &:hover {
        background-color: ${theme.colors.gray600};
      }
      & > td {
        padding: ${theme.spacing.margin8}px ${theme.spacing.margin16}px;
      }
    }
  }
`;

const paginationCSS = (theme: Theme) => css`
  display: flex;
  justify-content: flex-end;
  padding: ${theme.spacing.margin8}px;
  gap: ${theme.spacing.margin4}px;
  border-top: 1px solid ${theme.colors.gray500};
`;

type TableProps<DataRow extends object> = {
  columns: Column<DataRow>[];
  data: DataRow[];
};

export function Table<DataRow extends object>({
  columns,
  data,
}: TableProps<DataRow>) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    // Instead of using 'rows', we'll use page,
    // which has only the rows for the active page
    canPreviousPage,
    canNextPage,
    nextPage,
    previousPage,
  } = useTable<DataRow>(
    {
      columns,
      data,
      initialState: { pageIndex: 0 },
    },
    usePagination
  );
  return (
    <>
      <table {...getTableProps()} css={tableCSS}>
        <thead>
          {headerGroups.map((headerGroup, idx) => (
            <tr {...headerGroup.getHeaderGroupProps()} key={idx}>
              {headerGroup.headers.map((column, idx) => (
                <th {...column.getHeaderProps()} key={idx}>
                  {column.render("Header")}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {page.map((row, idx) => {
            prepareRow(row);
            return (
              <tr {...row.getRowProps()} key={idx}>
                {row.cells.map((cell, idx) => {
                  return (
                    <td {...cell.getCellProps()} key={idx}>
                      {cell.render("Cell")}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* 
        TODO(mikeldking): style tables
          This is just a very basic UI implementation
        */}
      <div css={paginationCSS}>
        <Button
          variant="default"
          size="compact"
          onClick={() => previousPage()}
          disabled={!canPreviousPage}
          aria-label="Previous Page"
          icon={<Icon svg={<Icons.ArrowIosBackOutline />} />}
        />

        <Button
          variant="default"
          size="compact"
          onClick={() => nextPage()}
          disabled={!canNextPage}
          aria-label="Next Page"
          icon={<Icon svg={<Icons.ArrowIosForwardOutline />} />}
        />
      </div>
    </>
  );
}
