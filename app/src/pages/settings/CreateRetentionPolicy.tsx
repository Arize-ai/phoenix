import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  useNotifyError,
  useNotifySuccess,
} from "@phoenix/contexts/NotificationContext";

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
export function CreateRetentionPolicy(props: {
  onCreate: () => void;
  queryId: string;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [submit, isSubitting] = useMutation<CreateRetentionPolicyMutation>(
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
    const connectionId = ConnectionHandler.getConnectionID(
      props.queryId,
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
      onError: () => {
        notifyError({
          title: "Error creating retention policy",
          message: "Please try again.",
        });
      },
    });
  };
  return (
    <RetentionPolicyForm
      onSubmit={onSubmit}
      isSubmitting={isSubitting}
      mode="create"
    />
  );
}
