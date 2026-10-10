import { useState } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import { fetchQuery, type RecordSourceSelectorProxy } from "relay-runtime";

import { Switch, Text } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import type { ProjectEvaluatorEnabledSwitchClearMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchClearMutation.graphql";
import type { ProjectEvaluatorEnabledSwitchMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchMutation.graphql";
import type { ProjectEvaluatorEnabledSwitchRunSummaryQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorEnabledSwitchRunSummaryQuery.graphql";
import { ClearQueueConfirmDialog } from "@phoenix/pages/project/evaluators/ClearQueueConfirmDialog";
import { useRefreshQueueStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

export function ProjectEvaluatorEnabledSwitch({
  projectEvaluatorId,
  name,
  enabled,
  clearableCount,
}: {
  projectEvaluatorId: string;
  name: string;
  enabled: boolean;
  /** The evaluator's queued evaluations that turning it off clears: not the running ones. */
  clearableCount: number;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const refreshQueueStats = useRefreshQueueStats();
  const notifyError = useNotifyError();
  const environment = useRelayEnvironment();
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
              runningCount
              droppedCount
              oldestQueuedAt
            }
          }
        }
      }
    `);

  const [commitClear, isClearInFlight] =
    useMutation<ProjectEvaluatorEnabledSwitchClearMutation>(graphql`
      mutation ProjectEvaluatorEnabledSwitchClearMutation(
        $input: ClearProjectEvaluatorQueuedEvaluationsInput!
      ) {
        clearProjectEvaluatorQueuedEvaluations(input: $input) {
          evaluator {
            id
            runSummary {
              status
              queuedCount
              runningCount
              droppedCount
              oldestQueuedAt
            }
          }
        }
      }
    `);

  const label = `${enabled ? "Disable" : "Enable"} ${name}`;

  const markDisabled = (store: RecordSourceSelectorProxy) => {
    const evaluator = store.get(projectEvaluatorId);
    evaluator?.setValue(false, "enabled");
    const runSummary = evaluator?.getLinkedRecord("runSummary");
    runSummary?.setValue("DISABLED", "status");
    // Running evaluations finish; only the rest are cleared.
    runSummary?.setValue(
      runSummary.getValue("runningCount") ?? 0,
      "queuedCount"
    );
    runSummary?.setValue(null, "oldestQueuedAt");
  };

  // The row showed the evaluator as cleared; read back what is still queued.
  const refetchRunSummary = () => {
    fetchQuery<ProjectEvaluatorEnabledSwitchRunSummaryQuery>(
      environment,
      graphql`
        query ProjectEvaluatorEnabledSwitchRunSummaryQuery($id: ID!) {
          node(id: $id) {
            ... on ProjectEvaluator {
              id
              runSummary {
                status
                queuedCount
                runningCount
                droppedCount
                oldestQueuedAt
              }
            }
          }
        }
      `,
      { id: projectEvaluatorId },
      { fetchPolicy: "network-only" }
    ).subscribe({});
  };

  const onClearFailed = (message: string) => {
    refetchRunSummary();
    refreshQueueStats();
    notifyError({
      title: `Disabled ${name}, but couldn't clear its queue`,
      message,
      expireMs: null,
      action: { text: "Retry", onClick: () => clearQueue() },
    });
  };

  const clearQueue = () => {
    commitClear({
      variables: { input: { projectEvaluatorId } },
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          onClearFailed(errors.map(({ message }) => message).join("\n"));
          return;
        }
        refreshQueueStats();
      },
      onError: (error) => {
        onClearFailed(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  const onUpdateFailed = (message: string) => {
    notifyError({ title: `Failed to update ${name}`, message });
  };

  const setEnabled = (nextEnabled: boolean) => {
    commit({
      variables: {
        input: { projectEvaluatorId, enabled: nextEnabled },
      },
      // Only the server knows which status a re-enabled evaluator returns to.
      // A disabled one shows as cleared until the clear that follows reports
      // the real counts.
      optimisticUpdater: nextEnabled ? undefined : markDisabled,
      updater: nextEnabled ? undefined : markDisabled,
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          onUpdateFailed(errors.map(({ message }) => message).join("\n"));
          return;
        }
        if (nextEnabled) {
          refreshQueueStats();
        } else {
          clearQueue();
        }
      },
      onError: (error) => {
        onUpdateFailed(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
    });
  };

  const onChange = (nextEnabled: boolean) => {
    if (!nextEnabled && clearableCount > 0) {
      setIsConfirmOpen(true);
      return;
    }
    setEnabled(nextEnabled);
  };

  return (
    <>
      <Switch
        aria-label={label}
        isSelected={enabled}
        isDisabled={isInFlight || isClearInFlight}
        onChange={onChange}
      >
        {/* Switch requires children; aria-label supplies the accessible name. */}
        {null}
      </Switch>
      <ClearQueueConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Disable evaluator"
        confirmLabel="Disable"
        onConfirm={() => {
          setIsConfirmOpen(false);
          setEnabled(false);
        }}
        isPending={isInFlight || isClearInFlight}
      >
        <Text>
          {clearableCount === 1
            ? `Disabling “${name}” clears its 1 queued evaluation.`
            : `Disabling “${name}” clears its ${intFormatter(clearableCount)} queued evaluations.`}
        </Text>
      </ClearQueueConfirmDialog>
    </>
  );
}
