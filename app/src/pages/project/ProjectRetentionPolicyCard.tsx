import React, { useMemo } from "react";
import { graphql, useFragment, useRefetchableFragment } from "react-relay";
import cronstrue from "cronstrue";

import { Card } from "@arizeai/components";

import { Flex, Link, Text, View } from "@phoenix/components";
import { ProjectTraceRetentionPolicySelect } from "@phoenix/components/retention/ProjectTraceRetentionPolicySelect";

import { ProjectRetentionPolicyCard_policy$key } from "./__generated__/ProjectRetentionPolicyCard_policy.graphql";
import { ProjectRetentionPolicyCard_query$key } from "./__generated__/ProjectRetentionPolicyCard_query.graphql";
import { ProjectRetentionPolicyCardQuery } from "./__generated__/ProjectRetentionPolicyCardQuery.graphql";

export const ProjectRetentionPolicyCard = ({
  project,
  query,
}: {
  project: ProjectRetentionPolicyCard_policy$key;
  query: ProjectRetentionPolicyCard_query$key;
}) => {
  const queryKey = useFragment(
    graphql`
      fragment ProjectRetentionPolicyCard_query on Query {
        ...ProjectTraceRetentionPolicySelectFragment
      }
    `,
    query
  );
  const [data] = useRefetchableFragment<
    ProjectRetentionPolicyCardQuery,
    ProjectRetentionPolicyCard_policy$key
  >(
    graphql`
      fragment ProjectRetentionPolicyCard_policy on Project
      @refetchable(queryName: "ProjectRetentionPolicyCardQuery") {
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

  const scheduleText = useMemo(() => {
    return cronstrue.toString(data.traceRetentionPolicy?.cronExpression || "");
  }, [data.traceRetentionPolicy?.cronExpression]);

  const handleRetentionPolicyChange = (_policyId: string) => {
    // Implementation for handling policy changes
    // Replace console.log with actual implementation
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
        <Flex direction="row" gap="size-200">
          <section>
            <b>Retention Policy</b>
            <Text>{data.traceRetentionPolicy?.name}</Text>
            <ProjectTraceRetentionPolicySelect
              defaultValue={data.traceRetentionPolicy?.id}
              onChange={handleRetentionPolicyChange}
              query={queryKey}
            />
          </section>
          <section>
            <b>Schedule</b>
            <Text>{scheduleText}</Text>
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
