import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Alert, Flex, Switch } from "@phoenix/components";
import type { ProjectEvaluatorEnabledSwitchMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export function ProjectEvaluatorEnabledSwitch({
  projectEvaluatorId,
  name,
  enabled,
}: {
  projectEvaluatorId: string;
  name: string;
  enabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commit, isInFlight] =
    useMutation<ProjectEvaluatorEnabledSwitchMutation>(graphql`
      mutation ProjectEvaluatorEnabledSwitchMutation(
        $input: SetProjectEvaluatorEnabledInput!
      ) {
        setProjectEvaluatorEnabled(input: $input) {
          evaluator {
            id
            enabled
          }
        }
      }
    `);

  const label = `${enabled ? "Disable" : "Enable"} ${name}`;

  const onChange = (nextEnabled: boolean) => {
    setError(null);
    commit({
      variables: {
        input: { projectEvaluatorId, enabled: nextEnabled },
      },
      optimisticResponse: {
        setProjectEvaluatorEnabled: {
          evaluator: {
            id: projectEvaluatorId,
            enabled: nextEnabled,
          },
        },
      },
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
        }
      },
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  return (
    <Flex direction="column" gap="size-50" alignItems="start">
      <Switch
        aria-label={label}
        isSelected={enabled}
        isDisabled={isInFlight}
        onChange={onChange}
      >
        {/* Switch requires children; aria-label supplies the accessible name. */}
        {null}
      </Switch>
      {error ? (
        <Alert variant="danger" title={`Failed to update ${name}`}>
          {error}
        </Alert>
      ) : null}
    </Flex>
  );
}
