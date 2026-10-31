import { flexRender, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Token } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { IntCell } from "@phoenix/components/table/IntCell";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import { DeleteDecisionLabelButton } from "@phoenix/pages/settings/decisions/DeleteDecisionLabelButton";

import type { DecisionLabelsTableFragment$key } from "./__generated__/DecisionLabelsTableFragment.graphql";

export function DecisionLabelsTable({
  query,
}: {
  query: DecisionLabelsTableFragment$key;
}) {
  const data = useFragment<DecisionLabelsTableFragment$key>(
    graphql`
      fragment DecisionLabelsTableFragment on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        decisionLabels(first: $first)
          @connection(key: "DecisionLabelsTable__decisionLabels") {
          edges {
            node {
              id
              name
              description
              color
              usageCount
            }
          }
        }
      }
    `,
    query
  );
  const tableData = useMemo(
    () => data.decisionLabels.edges.map((edge) => edge.node),
    [data.decisionLabels.edges]
  );

  const table = useTable({
    features: appTableFeatures,
    columns: [
      {
        header: "label",
        accessorKey: "name",
        cell: ({ row }) => {
          return (
            <Token color={row.original.color ?? undefined}>
              {row.original.name}
            </Token>
          );
        },
      },
      {
        header: "description",
        accessorKey: "description",
      },
      {
        header: "usage count",
        accessorKey: "usageCount",
        cell: IntCell,
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => {
          return (
            <Flex width="100%" alignItems="end" justifyContent="end">
              <DeleteDecisionLabelButton decisionLabelId={row.original.id} />
            </Flex>
          );
        },
      },
    ],
    data: tableData,
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
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="label" />}
        description="No decision labels"
      />
    </TableEmptyWrap>
  );
  return (
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
  );
}
