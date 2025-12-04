import { useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import { Alert } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

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
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
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
    setError(null);
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
    } else if (params.numberOfDays === 0) {
      rule = {
        maxDays: {
          maxDays: 0,
        },
      };
    } else {
      setError(
        "Invalid retention policy rule. Please enter a number of days or a number of traces, or both, to configure this policy."
      );
      return;
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
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            "An unknown error occurred while updating the retention policy. Please try again."
        );
      },
    });
  };

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <RetentionPolicyForm
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        mode="edit"
        defaultValues={{
          // Fallbacks should never happen, just to satisfy the type checker
          name: data.retentionPolicy.name ?? "New Policy",
          schedule: data.retentionPolicy.cronExpression ?? "0 0 * * 0",
          numberOfDays: data.retentionPolicy.rule?.maxDays,
          numberOfTraces: data.retentionPolicy.rule?.maxCount ?? null,
        }}
        onCancel={props.onCancel}
      />
    </>
  );
}
