import { graphql, useMutation } from "react-relay";

import { Switch } from "@phoenix/components";
import { toastQueue } from "@phoenix/contexts/NotificationContext";
import type { ProjectEvaluatorEnabledSwitchMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchMutation.graphql";
import type { EvaluatorInputMapping } from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * In-row enable/disable toggle for a project evaluator.
 *
 * Only CODE evaluators are toggleable here: the CODE update mutation accepts a
 * safe echo of the current values (source, output configs and mapping patch are
 * preserved when omitted), so flipping `enabled` leaves everything else intact.
 * The LLM update mutation instead requires a fully reconstructed prompt version
 * and creates a new one on every call, which is neither feasible nor desirable
 * from a table row, so the LLM toggle is shown read-only.
 */
export function ProjectEvaluatorEnabledSwitch({
  projectEvaluatorId,
  kind,
  name,
  enabled,
  samplingRate,
  evaluationTarget,
  filterCondition,
  description,
  evaluatorInputMapping,
}: {
  projectEvaluatorId: string;
  kind: "LLM" | "CODE" | "BUILTIN";
  name: string;
  enabled: boolean;
  samplingRate: number;
  evaluationTarget: "SPAN" | "TRACE" | "SESSION";
  filterCondition: string | null;
  description: string | null;
  evaluatorInputMapping: EvaluatorInputMapping | null;
}) {
  const [commit, isInFlight] =
    useMutation<ProjectEvaluatorEnabledSwitchMutation>(
      graphql`
        mutation ProjectEvaluatorEnabledSwitchMutation(
          $input: UpdateProjectCodeEvaluatorInput!
        ) {
          updateProjectCodeEvaluator(input: $input) {
            evaluator {
              id
              enabled
            }
          }
        }
      `
    );

  const label = `${enabled ? "Disable" : "Enable"} ${name}`;

  if (kind !== "CODE") {
    return (
      <Switch
        aria-label={label}
        isSelected={enabled}
        isDisabled
        onChange={noop}
      >
        {null}
      </Switch>
    );
  }

  const onChange = (nextEnabled: boolean) => {
    commit({
      variables: {
        input: {
          projectEvaluatorId,
          name,
          description,
          evaluatorInputMapping: (evaluatorInputMapping ?? {
            pathMapping: {},
            literalMapping: {},
          }) as EvaluatorInputMapping,
          samplingRate,
          evaluationTarget,
          filterCondition: filterCondition ?? "",
          enabled: nextEnabled,
        },
      },
      optimisticResponse: {
        updateProjectCodeEvaluator: {
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

function noop() {}

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
