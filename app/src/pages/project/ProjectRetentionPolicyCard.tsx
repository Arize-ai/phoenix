import { useMemo } from "react";
import { graphql, useFragment, useMutation } from "react-relay";

import { Card } from "@arizeai/components";

import { Flex, Link, Text, View } from "@phoenix/components";
import { ProjectTraceRetentionPolicySelect } from "@phoenix/components/retention/ProjectTraceRetentionPolicySelect";
import {
  useNotifyError,
  useNotifySuccess,
  useViewerCanManageRetentionPolicy,
} from "@phoenix/contexts";
import {
  createPolicyDeletionSummaryText,
  createPolicyScheduleSummaryText,
} from "@phoenix/utils/retentionPolicyUtils";

import { ProjectRetentionPolicyCard_policy$key } from "./__generated__/ProjectRetentionPolicyCard_policy.graphql";
import { ProjectRetentionPolicyCard_query$key } from "./__generated__/ProjectRetentionPolicyCard_query.graphql";
import { ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation } from "./__generated__/ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation.graphql";

export const ProjectRetentionPolicyCard = ({
  project,
  query,
}: {
  project: ProjectRetentionPolicyCard_policy$key;
  query: ProjectRetentionPolicyCard_query$key;
}) => {
  const canManageRetentionPolicy = useViewerCanManageRetentionPolicy();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const queryKey = useFragment(
    graphql`
      fragment ProjectRetentionPolicyCard_query on Query {
        ...ProjectTraceRetentionPolicySelectFragment
      }
    `,
    query
  );
  const data = useFragment<ProjectRetentionPolicyCard_policy$key>(
    graphql`
      fragment ProjectRetentionPolicyCard_policy on Project {
        id
        name
        traceRetentionPolicy {
          id
          name
          cronExpression
          rule {
            ... on TraceRetentionRuleMaxDays {
              maxDays
            }
            ... on TraceRetentionRuleMaxCount {
              maxCount
            }
            ... on TraceRetentionRuleMaxDaysOrCount {
              maxDays
              maxCount
            }
          }
        }
      }
    `,
    project
  );

  const [commit, isCommitting] =
    useMutation<ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation>(
      graphql`
        mutation ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation(
          $projectId: ID!
          $policyId: ID!
        ) {
          patchProjectTraceRetentionPolicy(
            input: { id: $policyId, addProjects: [$projectId] }
          ) {
            query {
              node(id: $projectId) {
                ... on Project {
                  ...ProjectRetentionPolicyCard_policy
                }
              }
            }
          }
        }
      `
    );

  const scheduleText = useMemo(() => {
    return createPolicyScheduleSummaryText({
      schedule: data.traceRetentionPolicy?.cronExpression || "",
    });
  }, [data.traceRetentionPolicy?.cronExpression]);

  const handleRetentionPolicyChange = (policyId: string) => {
    commit({
      variables: {
        projectId: data.id,
        policyId: policyId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Project retention policy updated",
          message:
            "The new policy will take effect at the configured schedule.",
        });
      },
      onError: () => {
        notifyError({
          title: "Failed to update retention policy",
          message: "Please try again.",
        });
      },
    });
  };

  return (
    <Card
      title="Data Retention"
      variant="compact"
      bodyStyle={{
        padding: 0,
      }}
    >
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="row" gap="size-400" alignItems="center">
          <section>
            <ProjectTraceRetentionPolicySelect
              defaultValue={data.traceRetentionPolicy?.id}
              onChange={handleRetentionPolicyChange}
              query={queryKey}
              isDisabled={isCommitting || !canManageRetentionPolicy}
            />
          </section>
          <section>
            <Flex direction="column" gap="size-100">
              <Text>
                {createPolicyDeletionSummaryText({
                  numberOfDays: data.traceRetentionPolicy?.rule?.maxDays,
                  numberOfTraces: data.traceRetentionPolicy?.rule?.maxCount,
                })}
              </Text>
              <Text>
                <b>Schedule:</b> {scheduleText}
              </Text>
            </Flex>
          </section>
        </Flex>
      </View>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderTopWidth="thin"
        borderColor="dark"
      >
        <Flex direction="row" justifyContent="end">
          <Link to="/settings/data">Configure Retention Policies</Link>
        </Flex>
      </View>
    </Card>
  );
};
