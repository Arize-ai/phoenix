import { startTransition, Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "@phoenix/components";
import { useNotifySuccess, useViewerCanModify } from "@phoenix/contexts";
import type { ClearQueuedEvaluationsMenuAllCountsQuery } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsMenuAllCountsQuery.graphql";
import type { ClearQueuedEvaluationsMenuClearAllMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsMenuClearAllMutation.graphql";
import type { ClearQueuedEvaluationsMenuCountsQuery } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsMenuCountsQuery.graphql";
import type { ClearQueuedEvaluationsMenuMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsMenuMutation.graphql";
import { ClearQueueConfirmDialog } from "@phoenix/pages/project/evaluators/ClearQueueConfirmDialog";
import {
  formatQueueCount,
  getClearableCount,
} from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import { useRefreshQueueStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Whose queued evaluations to clear: one project's, or every project's. */
export type ClearScope =
  | { type: "PROJECT"; projectId: string }
  | { type: "ALL" };

/**
 * A "more" menu holding the action that clears queued evaluations, kept out
 * of reach of a stray click: one project's on its evaluators tab, every
 * project's on the server-wide project evaluators view.
 */
export function ClearQueuedEvaluationsMenu({
  scope,
  isQueueEmpty = false,
  onCleared,
}: {
  scope: ClearScope;
  /** Nothing in the queue that clearing would remove. */
  isQueueEmpty?: boolean;
  onCleared?: () => void;
}) {
  const canModify = useViewerCanModify();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Keys the dialog, so each opening starts with fresh counts and no error.
  const [dialogOpenCount, setDialogOpenCount] = useState(0);
  if (!canModify) {
    return null;
  }
  return (
    <>
      <MenuTrigger>
        <Button
          size="S"
          variant="quiet"
          aria-label="Queue actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover placement="bottom end">
          <Menu
            disabledKeys={isQueueEmpty ? ["clear"] : []}
            onAction={(key) => {
              if (key === "clear") {
                setDialogOpenCount((count) => count + 1);
                setIsDialogOpen(true);
              }
            }}
          >
            <MenuItem
              id="clear"
              leadingContent={<Icon svg={<Icons.Trash />} />}
            >
              Clear queue…
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <ClearQueuedEvaluationsDialog
        key={dialogOpenCount}
        scope={scope}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
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
    useMutation<ClearQueuedEvaluationsMenuMutation>(graphql`
      mutation ClearQueuedEvaluationsMenuMutation(
        $input: ClearProjectQueuedEvaluationsInput!
      ) {
        clearProjectQueuedEvaluations(input: $input) {
          clearedCount
        }
      }
    `);
  const [commitClearAll, isClearingAll] =
    useMutation<ClearQueuedEvaluationsMenuClearAllMutation>(graphql`
      mutation ClearQueuedEvaluationsMenuClearAllMutation {
        clearAllQueuedEvaluations {
          clearedCount
        }
      }
    `);
  const onCleared = (clearedCount: number) => {
    notifySuccess({
      title: "Queue cleared",
      message:
        clearedCount === 1
          ? "Cleared 1 queued evaluation."
          : `Cleared ${intFormatter(clearedCount)} queued evaluations.`,
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
            onCleared(response.clearAllQueuedEvaluations.clearedCount);
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
          onCleared(response.clearProjectQueuedEvaluations.clearedCount);
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
  const data = useLazyLoadQuery<ClearQueuedEvaluationsMenuCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsMenuCountsQuery($projectId: ID!) {
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
  const data = useLazyLoadQuery<ClearQueuedEvaluationsMenuAllCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsMenuAllCountsQuery {
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
        : `Clears ${formatQueueCount(count)} queued evaluations ${where}.`}
    </Text>
  );
}
