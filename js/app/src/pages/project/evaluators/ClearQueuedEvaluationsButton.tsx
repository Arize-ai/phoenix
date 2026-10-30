import { startTransition, Suspense, useState } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import { Button, Icon, Icons, Text } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { useNotifySuccess, useViewerCanModify } from "@phoenix/contexts";
import type { ClearQueuedEvaluationsButtonAllCountsQuery } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonAllCountsQuery.graphql";
import type { ClearQueuedEvaluationsButtonClearAllMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonClearAllMutation.graphql";
import type { ClearQueuedEvaluationsButtonCountsQuery } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonCountsQuery.graphql";
import type { ClearQueuedEvaluationsButtonMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonMutation.graphql";
import { ClearQueueConfirmDialog } from "@phoenix/pages/project/evaluators/ClearQueueConfirmDialog";
import { useRefreshQueueStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Whose queued evaluations to clear: one project's, or every project's. */
type ClearScope = { type: "PROJECT"; projectId: string } | { type: "ALL" };

/** Clears this project's queued evaluations. */
export function ClearQueuedEvaluationsButton({
  projectId,
  isProjectQueueEmpty = false,
}: {
  projectId: string;
  /** This project has nothing clearing would remove. */
  isProjectQueueEmpty?: boolean;
}) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  return (
    <ClearQueueButton
      scope={{ type: "PROJECT", projectId }}
      isDisabled={isProjectQueueEmpty}
      onCleared={() => {
        void refetchProjectEvaluators({
          environment,
          projectId,
          timeRange: timeRangeISOStrings,
        });
      }}
    />
  );
}

/**
 * Clears every project's queued evaluations. Lives on the server-wide project
 * evaluators view only: a project's page clears only its own.
 */
export function ClearAllQueuedEvaluationsButton({
  isQueueEmpty = false,
  onCleared,
}: {
  /** Nothing in the queue that clearing would remove. */
  isQueueEmpty?: boolean;
  onCleared?: () => void;
}) {
  return (
    <ClearQueueButton
      scope={{ type: "ALL" }}
      isDisabled={isQueueEmpty}
      onCleared={onCleared}
    />
  );
}

function ClearQueueButton({
  scope,
  isDisabled,
  onCleared,
}: {
  scope: ClearScope;
  isDisabled: boolean;
  onCleared?: () => void;
}) {
  const canModify = useViewerCanModify();
  const [isOpen, setIsOpen] = useState(false);
  // Keys the dialog, so each opening starts with fresh counts and no error.
  const [openCount, setOpenCount] = useState(0);
  if (!canModify) {
    return null;
  }
  return (
    <>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        isDisabled={isDisabled}
        onPress={() => {
          setOpenCount((count) => count + 1);
          setIsOpen(true);
        }}
      >
        Clear queue
      </Button>
      <ClearQueuedEvaluationsDialog
        key={openCount}
        scope={scope}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onCleared={onCleared}
      />
    </>
  );
}

function ClearQueuedEvaluationsDialog({
  scope,
  isOpen,
  onOpenChange,
  onCleared: onClearedProp,
}: {
  scope: ClearScope;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCleared?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const refreshQueueStats = useRefreshQueueStats();
  const [error, setError] = useState<string | null>(null);
  const [commitClearProject, isClearingProject] =
    useMutation<ClearQueuedEvaluationsButtonMutation>(graphql`
      mutation ClearQueuedEvaluationsButtonMutation(
        $input: ClearQueuedEvaluationsInput!
      ) {
        clearQueuedEvaluations(input: $input) {
          droppedCount
        }
      }
    `);
  const [commitClearAll, isClearingAll] =
    useMutation<ClearQueuedEvaluationsButtonClearAllMutation>(graphql`
      mutation ClearQueuedEvaluationsButtonClearAllMutation {
        clearAllQueuedEvaluations {
          droppedCount
        }
      }
    `);
  const onCleared = (droppedCount: number) => {
    notifySuccess({
      title: "Queue cleared",
      message:
        droppedCount === 1
          ? "Cleared 1 queued evaluation."
          : `Cleared ${intFormatter(droppedCount)} queued evaluations.`,
    });
    onOpenChange(false);
    refreshQueueStats();
    onClearedProp?.();
  };
  const onFailed = (messages: ReadonlyArray<string>) => {
    setError(messages.join("\n"));
  };
  const onMutationError = (mutationError: Error) => {
    onFailed(
      getErrorMessagesFromRelayMutationError(mutationError) ?? [
        mutationError.message,
      ]
    );
  };
  const handleClear = () => {
    setError(null);
    startTransition(() => {
      if (scope.type === "ALL") {
        commitClearAll({
          variables: {},
          onCompleted: (response, errors) => {
            if (errors?.length) {
              onFailed(errors.map(({ message }) => message));
              return;
            }
            onCleared(response.clearAllQueuedEvaluations.droppedCount);
          },
          onError: onMutationError,
        });
        return;
      }
      commitClearProject({
        variables: { input: { projectId: scope.projectId } },
        onCompleted: (response, errors) => {
          if (errors?.length) {
            onFailed(errors.map(({ message }) => message));
            return;
          }
          onCleared(response.clearQueuedEvaluations.droppedCount);
        },
        onError: onMutationError,
      });
    });
  };
  return (
    <ClearQueueConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={
        scope.type === "ALL"
          ? "Clear queued evaluations for all projects"
          : "Clear queued evaluations"
      }
      confirmLabel={scope.type === "ALL" ? "Clear all" : "Clear queue"}
      onConfirm={handleClear}
      isPending={isClearingProject || isClearingAll}
      error={error}
    >
      <Suspense fallback={<ClearSummary scope={scope} count={null} />}>
        {scope.type === "ALL" ? (
          <ClearAllSummaryWithCount />
        ) : (
          <ClearProjectSummaryWithCount projectId={scope.projectId} />
        )}
      </Suspense>
    </ClearQueueConfirmDialog>
  );
}

/** What clearing this project's queue removes, counted when the dialog opens. */
function ClearProjectSummaryWithCount({ projectId }: { projectId: string }) {
  const data = useLazyLoadQuery<ClearQueuedEvaluationsButtonCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsButtonCountsQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            evaluationQueue {
              queuedCount
              runningCount
            }
          }
        }
      }
    `,
    { projectId },
    // Counts from when the dialog opened, not from an earlier visit.
    { fetchPolicy: "network-only" }
  );
  return (
    <ClearSummary
      scope={{ type: "PROJECT", projectId }}
      count={getClearableCount(data.project?.evaluationQueue)}
    />
  );
}

/** What clearing every project's queue removes, counted when the dialog opens. */
function ClearAllSummaryWithCount() {
  const data = useLazyLoadQuery<ClearQueuedEvaluationsButtonAllCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsButtonAllCountsQuery {
        evaluationQueue {
          queuedCount
          runningCount
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <ClearSummary
      scope={{ type: "ALL" }}
      count={getClearableCount(data.evaluationQueue)}
    />
  );
}

/** Clearing keeps running evaluations, so they are not counted. */
function getClearableCount(
  counts: { queuedCount: number; runningCount: number } | null | undefined
): number {
  return counts == null ? 0 : counts.queuedCount - counts.runningCount;
}

function ClearSummary({
  scope,
  count,
}: {
  scope: ClearScope;
  /** Null while the count loads. */
  count: number | null;
}) {
  const where =
    scope.type === "ALL" ? "across all projects" : "in this project";
  if (count == null) {
    return <Text>{`Clears the queued evaluations ${where}.`}</Text>;
  }
  return (
    <Text>
      {count === 1
        ? `Clears 1 queued evaluation ${where}.`
        : `Clears ${intFormatter(count)} queued evaluations ${where}.`}
    </Text>
  );
}
