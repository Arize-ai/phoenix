import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Alert, Flex, Switch, Text } from "@phoenix/components";
import type { ProjectEvaluatorEnabledSwitchMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchMutation.graphql";
import { ClearQueueConfirmDialog } from "@phoenix/pages/project/evaluators/ClearQueueConfirmDialog";
import { useRefreshQueueStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

export function ProjectEvaluatorEnabledSwitch({
  projectEvaluatorId,
  name,
  enabled,
  queuedCount,
}: {
  projectEvaluatorId: string;
  name: string;
  enabled: boolean;
  /** The evaluator's queued evaluations, which turning it off clears. */
  queuedCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const refreshQueueStats = useRefreshQueueStats();
  const [commit, isInFlight] =
    useMutation<ProjectEvaluatorEnabledSwitchMutation>(graphql`
      mutation ProjectEvaluatorEnabledSwitchMutation(
        $input: SetProjectEvaluatorEnabledInput!
      ) {
        setProjectEvaluatorEnabled(input: $input) {
          evaluator {
            id
            enabled
            runSummary {
              status
              queuedCount
              droppedCount
              oldestQueuedAt
            }
          }
        }
      }
    `);

  const label = `${enabled ? "Disable" : "Enable"} ${name}`;

  const setEnabled = (nextEnabled: boolean) => {
    setError(null);
    commit({
      variables: {
        input: { projectEvaluatorId, enabled: nextEnabled },
      },
      // Only the server knows which status a re-enabled evaluator returns to,
      // and how many queued evaluations the disable dropped.
      optimisticUpdater: nextEnabled
        ? undefined
        : (store) => {
            const evaluator = store.get(projectEvaluatorId);
            evaluator?.setValue(false, "enabled");
            const runSummary = evaluator?.getLinkedRecord("runSummary");
            runSummary?.setValue("DISABLED", "status");
            runSummary?.setValue(0, "queuedCount");
            runSummary?.setValue(null, "oldestQueuedAt");
          },
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        refreshQueueStats();
      },
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  const onChange = (nextEnabled: boolean) => {
    if (!nextEnabled && queuedCount > 0) {
      setIsConfirmOpen(true);
      return;
    }
    setEnabled(nextEnabled);
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
      <ClearQueueConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Disable evaluator"
        confirmLabel="Disable"
        onConfirm={() => {
          setIsConfirmOpen(false);
          setEnabled(false);
        }}
        isPending={isInFlight}
      >
        <Text>
          {queuedCount === 1
            ? `Disabling “${name}” clears its 1 queued evaluation.`
            : `Disabling “${name}” clears its ${intFormatter(queuedCount)} queued evaluations.`}
        </Text>
      </ClearQueueConfirmDialog>
    </Flex>
  );
}
