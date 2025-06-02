import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  useNotifyError,
  useNotifySuccess,
} from "@phoenix/contexts/NotificationContext";

import type { ProjectTraceRetentionRuleInput } from "./__generated__/CreateRetentionPolicyMutation.graphql";
import type { EditRetentionPolicyMutation } from "./__generated__/EditRetentionPolicyMutation.graphql";
import { EditRetentionPolicyQuery } from "./__generated__/EditRetentionPolicyQuery.graphql";
import {
  RetentionPolicyForm,
  RetentionPolicyFormParams,
} from "./RetentionPolicyForm";

interface EditRetentionPolicyProps {
  policyId: string;
  onEditCompleted: () => void;
  onCancel?: () => void;
}

/**
 * A Wrapper around the RetentionPolicyForm component that is used to edit an existing retention policy.
 */
export function EditRetentionPolicy(props: EditRetentionPolicyProps) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const data = useLazyLoadQuery<EditRetentionPolicyQuery>(
    graphql`
      query EditRetentionPolicyQuery($id: ID!) {
        retentionPolicy: node(id: $id) {
          ... on ProjectTraceRetentionPolicy {
            id
            name
            cronExpression
            rule {
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
          }
        }
      }
    `,
    {
      id: props.policyId,
    }
  );

  if (!data?.retentionPolicy) {
    throw new Error("Retention policy not found");
  }

  const [submit, isSubmitting] = useMutation<EditRetentionPolicyMutation>(
    graphql`
      mutation EditRetentionPolicyMutation(
        $input: PatchProjectTraceRetentionPolicyInput!
      ) {
        patchProjectTraceRetentionPolicy(input: $input) {
          query {
            ...RetentionPoliciesTable_policies
          }
        }
      }
    `
  );

  const onSubmit = (params: RetentionPolicyFormParams) => {
    let rule: ProjectTraceRetentionRuleInput;
    if (params.numberOfDays && params.numberOfTraces) {
      rule = {
        maxDaysOrCount: {
          maxDays: params.numberOfDays,
          maxCount: params.numberOfTraces,
        },
      };
    } else if (params.numberOfDays) {
      rule = {
        maxDays: {
          maxDays: params.numberOfDays,
        },
      };
    } else if (params.numberOfTraces) {
      rule = {
        maxCount: {
          maxCount: params.numberOfTraces,
        },
      };
    } else {
      throw new Error("Invalid retention policy rule");
    }

    submit({
      variables: {
        input: {
          id: props.policyId,
          cronExpression: params.schedule,
          rule,
          name: params.name,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Retention policy updated successfully",
          message: "The retention policy has been updated successfully.",
        });
        props.onEditCompleted();
      },
      onError: () => {
        notifyError({
          title: "Error updating retention policy",
          message: "Please try again.",
        });
      },
    });
  };

  return (
    <RetentionPolicyForm
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      mode="edit"
      defaultValues={{
        // Fallbacks should never happen, just to satisfy the type checker
        name: data.retentionPolicy.name ?? "New Policy",
        schedule: data.retentionPolicy.cronExpression ?? "0 0 * * 0",
        numberOfDays: data.retentionPolicy.rule?.maxDays,
        numberOfTraces: data.retentionPolicy.rule?.maxCount,
      }}
      onCancel={props.onCancel}
    />
  );
}
