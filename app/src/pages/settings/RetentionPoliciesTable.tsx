import React, { useEffect, useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import cronstrue from "cronstrue";
import { css } from "@emotion/react";

import { Link } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import { assertUnreachable } from "@phoenix/typeUtils";

import { RetentionPoliciesTable_policies$key } from "./__generated__/RetentionPoliciesTable_policies.graphql";
import { RetentionPoliciesTablePoliciesQuery } from "./__generated__/RetentionPoliciesTablePoliciesQuery.graphql";
export const RetentionPoliciesTable = ({
  query,
  fetchKey,
}: {
  query: RetentionPoliciesTable_policies$key;
  /**
   * A temporary workaround to force a refetch of the table when a new policy is created.
   * This is because the refetchable fragment doesn't refetch when the data is updated.
   */
  fetchKey: number;
}) => {
  const [data, refetch] = useRefetchableFragment<
    RetentionPoliciesTablePoliciesQuery,
    RetentionPoliciesTable_policies$key
  >(
    graphql`
      fragment RetentionPoliciesTable_policies on Query
      @refetchable(queryName: "RetentionPoliciesTablePoliciesQuery") {
        projectTraceRetentionPolicies {
          edges {
            node {
              id
              name
              cronExpression
              rule {
                __typename
                ... on TraceRetentionRuleMaxCount {
                  maxCount
                }
                ... on TraceRetentionRuleMaxDays {
                  maxDays
                }
                ... on TraceRetentionRuleMaxDaysOrCount {
                  maxDays
                  maxCount
                }
              }
              projects {
                edges {
                  node {
                    name
                    id
                  }
                }
              }
            }
          }
        }
      }
    `,
    query
  );

  /**
   * This is a temporary workaround to force a refetch of the table when a new policy is created.
   */
  useEffect(() => {
    if (fetchKey > 0) {
      refetch(
        {},
        {
          fetchPolicy: "network-only",
        }
      );
    }
  }, [fetchKey, refetch]);

  const tableData = data.projectTraceRetentionPolicies.edges.map(
    (edge) => edge.node
  );

  const columns: ColumnDef<(typeof tableData)[number]>[] = useMemo(
    () => [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        header: "Schedule",
        accessorKey: "cronExpression",
        cell: ({ row }) => {
          return cronstrue.toString(row.original.cronExpression);
        },
      },
      {
        header: "Rule",
        accessorKey: "rule",
        cell: ({ row }) => {
          const rule = row.original.rule;
          if (rule.__typename === "TraceRetentionRuleMaxCount") {
            return `${rule.maxCount} traces`;
          }
          if (rule.__typename === "TraceRetentionRuleMaxDays") {
            if (rule.maxDays === 0) {
              return "Infinite";
            }
            return `${rule.maxDays} days`;
          }
          if (rule.__typename === "TraceRetentionRuleMaxDaysOrCount") {
            return `${rule.maxDays} days or ${rule.maxCount} traces`;
          }
          if (rule.__typename === "%other") {
            return "Unknown";
          }
          assertUnreachable(rule);
        },
      },
      {
        header: "Projects",
        accessorKey: "projects",
        cell: ({ row }) => {
          return (
            <ul
              css={css`
                li {
                  display: inline;
                }
                li:not(:first-child):before {
                  content: ", ";
                }
              `}
            >
              {row.original.projects.edges.map((edge) => (
                <li key={edge.node.id}>
                  <Link to={`/projects/${edge.node.id}/config`}>
                    {edge.node.name}
                  </Link>
                </li>
              ))}
            </ul>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

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
    </table>
  );
};
