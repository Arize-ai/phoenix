import { graphql, useMutation } from "react-relay";

import { Switch } from "@phoenix/components";
import { toastQueue } from "@phoenix/contexts/NotificationContext";
import type { ProjectEvaluatorEnabledSwitchMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * In-row enable/disable toggle for a project evaluator. Flips only the enabled
 * flag on the project binding through a dedicated mutation, so it works for both
 * LLM and CODE evaluators without reconstructing the underlying evaluator.
 */
export function ProjectEvaluatorEnabledSwitch({
  projectEvaluatorId,
  name,
  enabled,
}: {
  projectEvaluatorId: string;
  name: string;
  enabled: boolean;
}) {
  const [commit, isInFlight] =
    useMutation<ProjectEvaluatorEnabledSwitchMutation>(
      graphql`
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
      `
    );

  const label = `${enabled ? "Disable" : "Enable"} ${name}`;

  const onChange = (nextEnabled: boolean) => {
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
          notifyToggleError(
            name,
            errors.map(({ message }) => message).join("\n")
          );
        }
      },
      onError: (error) => {
        notifyToggleError(
          name,
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  return (
    <Switch
      aria-label={label}
      isSelected={enabled}
      isDisabled={isInFlight}
      onChange={onChange}
    >
      {null}
    </Switch>
  );
}

function notifyToggleError(name: string, message: string) {
  toastQueue.add(
    {
      title: `Failed to update ${name}`,
      message,
      variant: "error",
    },
    { timeout: 5000 }
  );
}
