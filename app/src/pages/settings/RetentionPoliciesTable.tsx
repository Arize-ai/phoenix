import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";

import { Flex, Text } from "@phoenix/components";
import { ProjectToken } from "@phoenix/components/project";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { useViewerCanManageRetentionPolicy } from "@phoenix/contexts/ViewerContext";
import {
  createPolicyRuleSummaryText,
  createPolicyScheduleSummaryText,
} from "@phoenix/utils/retentionPolicyUtils";

import type { RetentionPoliciesTable_policies$key } from "./__generated__/RetentionPoliciesTable_policies.graphql";
import type { RetentionPoliciesTable_retentionPolicy$key } from "./__generated__/RetentionPoliciesTable_retentionPolicy.graphql";
import type { RetentionPoliciesTablePoliciesQuery } from "./__generated__/RetentionPoliciesTablePoliciesQuery.graphql";
import { RetentionPolicyActionMenu } from "./RetentionPolicyActionMenu";

/**
 * The maximum number of project tokens to show in a row before collapsing
 * the remainder into an "and N more" affordance. The full list is visible
 * in the policy's details drawer.
 */
const MAX_VISIBLE_PROJECTS = 5;

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
          gradientStartColor
          gradientEndColor
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
  "use no memo";
  const navigate = useNavigate();
  const { policyId: selectedPolicyId } = useParams();
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

  const tableData = useMemo(
    () =>
      data.projectTraceRetentionPolicies.edges.map((edge) => {
        const node = edge.node;
        const data = readInlineData<RetentionPoliciesTable_retentionPolicy$key>(
          RETENTION_POLICY_FRAGMENT,
          node
        );
        return data;
      }),
    [data]
  );

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
          return createPolicyRuleSummaryText(row.original.rule);
        },
      },
      {
        header: "Projects",
        accessorKey: "projects",
        cell: ({ row }) => {
          const projects = row.original.projects.edges.map((edge) => edge.node);
          const visibleProjects = projects.slice(0, MAX_VISIBLE_PROJECTS);
          const hiddenProjectsCount = projects.length - visibleProjects.length;
          if (projects.length === 0) {
            return (
              <Text size="S" color="text-700">
                No projects
              </Text>
            );
          }
          return (
            <Flex direction="row" gap="size-50" wrap alignItems="center">
              {visibleProjects.map((project) => (
                <StopPropagation key={project.id}>
                  <ProjectToken
                    projectId={project.id}
                    name={project.name}
                    gradientStartColor={project.gradientStartColor}
                    gradientEndColor={project.gradientEndColor}
                  />
                </StopPropagation>
              ))}
              {hiddenProjectsCount > 0 && (
                <Text size="S" color="text-700">
                  and {hiddenProjectsCount} more
                </Text>
              )}
            </Flex>
          );
        },
      },
    ];
    if (canManageRetentionPolicy) {
      columns.push({
        id: "actions",
        cell: ({ row }) => {
          return (
            <StopPropagation>
              <RetentionPolicyActionMenu
                policyId={row.original.id}
                policyName={row.original.name}
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
            </StopPropagation>
          );
        },
      });
    }
    return columns;
  }, [canManageRetentionPolicy, notifySuccess]);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <table css={selectableTableCSS}>
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
            <tr
              key={row.id}
              data-selected={row.original.id === selectedPolicyId}
              onClick={() => navigate(`/settings/data/${row.original.id}`)}
            >
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
