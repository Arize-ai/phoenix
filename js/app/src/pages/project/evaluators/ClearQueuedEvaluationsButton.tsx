import { css } from "@emotion/react";
import { startTransition, Suspense, useRef, useState } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

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
import { useTimeRange } from "@phoenix/components/datetime";
import { useNotifySuccess, useViewerCanModify } from "@phoenix/contexts";
import type { ClearQueuedEvaluationsButtonClearAllMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonClearAllMutation.graphql";
import type { ClearQueuedEvaluationsButtonCountsQuery } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonCountsQuery.graphql";
import type { ClearQueuedEvaluationsButtonMutation } from "@phoenix/pages/project/evaluators/__generated__/ClearQueuedEvaluationsButtonMutation.graphql";
import { ClearQueueConfirmDialog } from "@phoenix/pages/project/evaluators/ClearQueueConfirmDialog";
import { useRefreshQueueStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Whose queued evaluations to clear: this project's, or every project's. */
type ClearScope = "PROJECT" | "ALL";

/** Joins the clear button and its menu button into one control. */
const splitButtonCSS = css`
  display: flex;
  flex-direction: row;
  & > .react-aria-Button:first-of-type {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  & > .react-aria-Button:last-of-type {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
    border-inline-start-width: 0;
  }
`;

/**
 * Clears this project's queued evaluations, with a menu on its right edge for
 * clearing every project's.
 */
export function ClearQueuedEvaluationsButton({
  projectId,
}: {
  projectId: string;
}) {
  const canModify = useViewerCanModify();
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<ClearScope>("PROJECT");
  // Keys the dialog, so each opening starts with fresh counts and no error.
  const [openCount, setOpenCount] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);
  if (!canModify) {
    return null;
  }
  const openDialog = (nextScope: ClearScope) => {
    setScope(nextScope);
    setOpenCount((count) => count + 1);
    setIsOpen(true);
  };
  return (
    <>
      <div
        ref={groupRef}
        role="group"
        aria-label="Clear queue"
        css={splitButtonCSS}
      >
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.Trash />} />}
          onPress={() => openDialog("PROJECT")}
        >
          Clear queue
        </Button>
        <MenuTrigger>
          <Button
            size="S"
            aria-label="More ways to clear the queue"
            leadingVisual={<Icon svg={<Icons.ChevronDown />} />}
          />
          {/* Opens under the whole control, not just the chevron. */}
          <Popover placement="bottom end" triggerRef={groupRef}>
            <Menu onAction={() => openDialog("ALL")}>
              <MenuItem id="ALL">Clear queue for all projects</MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <ClearQueuedEvaluationsDialog
        key={openCount}
        projectId={projectId}
        scope={scope}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}

function ClearQueuedEvaluationsDialog({
  projectId,
  scope,
  isOpen,
  onOpenChange,
}: {
  projectId: string;
  scope: ClearScope;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
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
    void refetchProjectEvaluators({
      environment,
      projectId,
      timeRange: timeRangeISOStrings,
    });
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
      if (scope === "ALL") {
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
        variables: { input: { projectId } },
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
        scope === "ALL"
          ? "Clear queued evaluations for all projects"
          : "Clear queued evaluations"
      }
      confirmLabel={scope === "ALL" ? "Clear all" : "Clear queue"}
      onConfirm={handleClear}
      isPending={isClearingProject || isClearingAll}
      error={error}
    >
      <Suspense fallback={<ClearSummary scope={scope} count={null} />}>
        <ClearSummaryWithCount projectId={projectId} scope={scope} />
      </Suspense>
    </ClearQueueConfirmDialog>
  );
}

/** What clearing removes, with how many evaluations are queued now. */
function ClearSummaryWithCount({
  projectId,
  scope,
}: {
  projectId: string;
  scope: ClearScope;
}) {
  const data = useLazyLoadQuery<ClearQueuedEvaluationsButtonCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsButtonCountsQuery($projectId: ID!) {
        evaluationQueue {
          queuedCount
        }
        project: node(id: $projectId) {
          ... on Project {
            evaluators(first: 100) {
              edges {
                node {
                  runSummary {
                    queuedCount
                  }
                }
              }
            }
          }
        }
      }
    `,
    { projectId },
    // Counts from when the dialog opened, not from an earlier visit.
    { fetchPolicy: "network-only" }
  );
  const sum = (counts: ReadonlyArray<number>) =>
    counts.reduce((total, count) => total + count, 0);
  const count =
    scope === "ALL"
      ? data.evaluationQueue.queuedCount
      : sum(
          (data.project?.evaluators?.edges ?? []).map(
            ({ node }) => node.runSummary.queuedCount
          )
        );
  return <ClearSummary scope={scope} count={count} />;
}

function ClearSummary({
  scope,
  count,
}: {
  scope: ClearScope;
  /** Null while the count loads. */
  count: number | null;
}) {
  const where = scope === "ALL" ? "across all projects" : "in this project";
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
