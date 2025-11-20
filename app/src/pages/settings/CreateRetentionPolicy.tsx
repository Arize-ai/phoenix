import { useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { Alert } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import {
  CreateRetentionPolicyMutation,
  ProjectTraceRetentionRuleInput,
} from "./__generated__/CreateRetentionPolicyMutation.graphql";
import {
  RetentionPolicyForm,
  RetentionPolicyFormParams,
} from "./RetentionPolicyForm";

/**
 * A Wrapper around the RetentionPolicyForm component that is used to create a new retention policy.
 */
export function CreateRetentionPolicy(props: { onCreate: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [submit, isSubmitting] = useMutation<CreateRetentionPolicyMutation>(
    graphql`
      mutation CreateRetentionPolicyMutation(
        $input: CreateProjectTraceRetentionPolicyInput!
        $connectionId: ID!
      ) {
        createProjectTraceRetentionPolicy(input: $input) {
          node
            @prependNode(
              connections: [$connectionId]
              edgeTypeName: "ProjectTraceRetentionPolicyEdge"
            ) {
            ...RetentionPoliciesTable_retentionPolicy
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
    const connectionId = ConnectionHandler.getConnectionID(
      "client:root",
      "RetentionPoliciesTable_projectTraceRetentionPolicies"
    );
    submit({
      variables: {
        input: {
          cronExpression: params.schedule,
          rule,
          name: params.name,
        },
        connectionId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Retention policy created successfully",
          message:
            "The retention policy has been created. You can now add this policy to projects.",
        });
        props.onCreate();
      },
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            "An unknown error occurred while creating the retention policy. Please try again."
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
        mode="create"
      />
    </>
  );
}
