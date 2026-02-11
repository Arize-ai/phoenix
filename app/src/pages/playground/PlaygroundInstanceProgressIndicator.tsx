import { memo } from "react";

import { Flex, Text } from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/progress/ProgressCircle";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

interface ProgressIndicatorProps {
  completed: number;
  total: number;
  failed: number;
  label: string;
}

/**
 * Reusable progress indicator component
 */
function ProgressIndicator({
  completed,
  total,
  failed,
  label,
}: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Flex direction="row" gap="size-50">
        <Text color="text-700" size="S">
          {completed}/{total} {label}
        </Text>
        {failed > 0 && (
          <Text color="danger" size="S">
            {failed} failed
          </Text>
        )}
      </Flex>
      <ProgressCircle
        value={percentage}
        size="S"
        aria-label={`${label} progress`}
      />
    </Flex>
  );
}

interface PlaygroundInstanceProgressIndicatorProps {
  instanceId: number;
}

/**
 * Progress indicator that connects directly to the store to avoid re-renders
 * when other parts of the playground state change
 */
export const PlaygroundInstanceProgressIndicator = memo(
  function PlaygroundInstanceProgressIndicator({
    instanceId,
  }: PlaygroundInstanceProgressIndicatorProps) {
    // Only subscribe to the specific instance's state
    const instance = usePlaygroundContext((state) =>
      state.instances.find((i) => i.id === instanceId)
    );

    // Don't render if there's no instance or no active run
    if (!instance || instance.activeRunId === null) {
      return null;
    }

    const experimentRunProgress = instance.experimentRunProgress;

    // If no progress yet but experiment is running, show 0 progress
    const totalRuns = experimentRunProgress?.totalRuns ?? 0;
    const runsCompleted = experimentRunProgress?.runsCompleted ?? 0;
    const runsFailed = experimentRunProgress?.runsFailed ?? 0;
    const totalEvals = experimentRunProgress?.totalEvals ?? 0;
    const evalsCompleted = experimentRunProgress?.evalsCompleted ?? 0;
    const evalsFailed = experimentRunProgress?.evalsFailed ?? 0;

    // Don't show anything if total runs is 0 (progress not initialized yet)
    if (totalRuns === 0) {
      return null;
    }

    // Determine if runs are complete
    const runsComplete = runsCompleted + runsFailed >= totalRuns;

    // Show evals progress if runs are complete and there are evals to track
    if (runsComplete && totalEvals > 0) {
      return (
        <ProgressIndicator
          completed={evalsCompleted}
          total={totalEvals}
          failed={evalsFailed}
          label="evals"
        />
      );
    }

    // Otherwise show runs progress
    return (
      <ProgressIndicator
        completed={runsCompleted}
        total={totalRuns}
        failed={runsFailed}
        label="runs"
      />
    );
  }
);
