import { startTransition, Suspense, useState } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Radio,
  RadioGroup,
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

export function ClearQueuedEvaluationsButton({
  projectId,
}: {
  projectId: string;
}) {
  const canModify = useViewerCanModify();
  const [isOpen, setIsOpen] = useState(false);
  // Keys the dialog, so each opening starts on this project with no error.
  const [openCount, setOpenCount] = useState(0);
  if (!canModify) {
    return null;
  }
  return (
    <>
      <Button
        size="M"
        variant="danger"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        onPress={() => {
          setOpenCount((count) => count + 1);
          setIsOpen(true);
        }}
      >
        Clear queue
      </Button>
      <ClearQueuedEvaluationsDialog
        key={openCount}
        projectId={projectId}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}

/** Whose queued evaluations to clear: this project's, or every project's. */
type ClearScope = "PROJECT" | "ALL";

function ClearQueuedEvaluationsDialog({
  projectId,
  isOpen,
  onOpenChange,
}: {
  projectId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const notifySuccess = useNotifySuccess();
  const refreshQueueStats = useRefreshQueueStats();
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ClearScope>("PROJECT");
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
      title="Clear queued evaluations"
      confirmLabel="Clear queue"
      onConfirm={handleClear}
      isPending={isClearingProject || isClearingAll}
      error={error}
    >
      <Suspense
        fallback={
          <ClearScopeOptions
            scope={scope}
            onScopeChange={setScope}
            counts={null}
          />
        }
      >
        <ClearScopeOptionsWithCounts
          projectId={projectId}
          scope={scope}
          onScopeChange={setScope}
        />
      </Suspense>
    </ClearQueueConfirmDialog>
  );
}

/** The scope choice, with how many evaluations each scope has queued now. */
function ClearScopeOptionsWithCounts({
  projectId,
  scope,
  onScopeChange,
}: {
  projectId: string;
  scope: ClearScope;
  onScopeChange: (scope: ClearScope) => void;
}) {
  const data = useLazyLoadQuery<ClearQueuedEvaluationsButtonCountsQuery>(
    graphql`
      query ClearQueuedEvaluationsButtonCountsQuery($projectId: ID!) {
        evaluationQueues {
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
  return (
    <ClearScopeOptions
      scope={scope}
      onScopeChange={onScopeChange}
      counts={{
        project: sum(
          (data.project?.evaluators?.edges ?? []).map(
            ({ node }) => node.runSummary.queuedCount
          )
        ),
        all: sum(data.evaluationQueues.map(({ queuedCount }) => queuedCount)),
      }}
    />
  );
}

function ClearScopeOptions({
  scope,
  onScopeChange,
  counts,
}: {
  scope: ClearScope;
  onScopeChange: (scope: ClearScope) => void;
  /** Null while the counts load. */
  counts: { project: number; all: number } | null;
}) {
  return (
    <RadioGroup
      aria-label="Evaluations to clear"
      direction="column"
      value={scope}
      onChange={(value) => onScopeChange(value as ClearScope)}
    >
      <Radio value="PROJECT">
        <ClearScopeLabel label="This project" count={counts?.project} />
      </Radio>
      <Radio value="ALL">
        <ClearScopeLabel label="All projects" count={counts?.all} />
      </Radio>
    </RadioGroup>
  );
}

function ClearScopeLabel({ label, count }: { label: string; count?: number }) {
  return (
    <Flex direction="row" gap="size-100" alignItems="baseline">
      {/* slot={null} opts out of RadioGroup's slotted text context. */}
      <Text slot={null}>{label}</Text>
      <Text slot={null} color="text-700">
        {count == null ? "--" : `${intFormatter(count)} queued`}
      </Text>
    </Flex>
  );
}
