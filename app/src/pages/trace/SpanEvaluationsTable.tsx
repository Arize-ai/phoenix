import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { PreformattedTextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import { SpanEvaluationsTable_evals$key } from "./__generated__/SpanEvaluationsTable_evals.graphql";

const columns = [
  {
    header: "name",
    accessorKey: "name",
    size: 100,
  },
  {
    header: "label",
    accessorKey: "label",
    size: 100,
  },
  {
    header: "score",
    accessorKey: "score",
    size: 100,
  },
  {
    header: "explanation",
    accessorKey: "explanation",
    cell: PreformattedTextCell,
    size: 400,
  },
];

export function SpanEvaluationsTable(props: {
  span: SpanEvaluationsTable_evals$key;
}) {
  const data = useFragment(
    graphql`
      fragment SpanEvaluationsTable_evals on Span {
        spanEvaluations {
          name
          label
          score
          explanation
        }
      }
    `,
    props.span
  );
  const evaluations = useMemo(() => {
    return [...data.spanEvaluations];
  }, [data.spanEvaluations]);

  const table = useReactTable({
    columns,
    data: evaluations,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <table css={tableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th colSpan={header.colSpan} key={header.id}>
                {header.isPlaceholder ? null : (
                  <>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {isEmpty ? (
        <TableEmpty />
      ) : (
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}
