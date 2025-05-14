import { useMemo } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Link } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import {
  useNotifySuccess,
  useViewerCanManageRetentionPolicy,
} from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";
import { createPolicyScheduleSummaryText } from "@phoenix/utils/retentionPolicyUtils";

import { RetentionPoliciesTable_policies$key } from "./__generated__/RetentionPoliciesTable_policies.graphql";
import { RetentionPoliciesTable_retentionPolicy$key } from "./__generated__/RetentionPoliciesTable_retentionPolicy.graphql";
import { RetentionPoliciesTablePoliciesQuery } from "./__generated__/RetentionPoliciesTablePoliciesQuery.graphql";
import { RetentionPolicyActionMenu } from "./RetentionPolicyActionMenu";

const RETENTION_POLICY_FRAGMENT = graphql`
  fragment RetentionPoliciesTable_retentionPolicy on ProjectTraceRetentionPolicy
  @inline {
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
`;
export const RetentionPoliciesTable = ({
  query,
}: {
  query: RetentionPoliciesTable_policies$key;
}) => {
  const notifySuccess = useNotifySuccess();
  const canManageRetentionPolicy = useViewerCanManageRetentionPolicy();
  const { data } = usePaginationFragment<
    RetentionPoliciesTablePoliciesQuery,
    RetentionPoliciesTable_policies$key
  >(
    graphql`
      fragment RetentionPoliciesTable_policies on Query
      @refetchable(queryName: "RetentionPoliciesTablePoliciesQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 1000 }
      ) {
        projectTraceRetentionPolicies(first: $first, after: $after)
          @connection(
            key: "RetentionPoliciesTable_projectTraceRetentionPolicies"
          ) {
          __id
          edges {
            node {
              ...RetentionPoliciesTable_retentionPolicy
            }
          }
        }
      }
    `,
    query
  );

  const connectionId = data.projectTraceRetentionPolicies.__id;
  const tableData = data.projectTraceRetentionPolicies.edges.map((edge) => {
    const node = edge.node;
    const data = readInlineData<RetentionPoliciesTable_retentionPolicy$key>(
      RETENTION_POLICY_FRAGMENT,
      node
    );
    return data;
  });

  const columns: ColumnDef<(typeof tableData)[number]>[] = useMemo(() => {
    const columns: ColumnDef<(typeof tableData)[number]>[] = [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        header: "Schedule",
        accessorKey: "cronExpression",
        cell: ({ row }) => {
          return createPolicyScheduleSummaryText({
            schedule: row.original.cronExpression,
          });
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
    ];
    if (canManageRetentionPolicy) {
      columns.push({
        id: "actions",
        cell: ({ row }) => {
          return (
            <RetentionPolicyActionMenu
              policyId={row.original.id}
              policyName={row.original.name}
              connectionId={connectionId}
              projectNames={row.original.projects.edges.map(
                (edge) => edge.node.name
              )}
              onPolicyEdit={() => {
                notifySuccess({
                  title: "Policy Updated",
                  message: `Policy "${row.original.name}" was updated and will take effect shortly.`,
                });
              }}
              onPolicyDelete={() => {
                notifySuccess({
                  title: "Policy deleted",
                  message: `Policy "${row.original.name}" was deleted`,
                });
              }}
            />
          );
        },
      });
    }
    return columns;
  }, [canManageRetentionPolicy, notifySuccess, connectionId]);

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
