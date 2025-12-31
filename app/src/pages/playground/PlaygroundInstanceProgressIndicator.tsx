import { memo } from "react";

import { Flex, Text } from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/progress/ProgressCircle";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

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
    const total = experimentRunProgress?.total ?? 0;
    const completed = experimentRunProgress?.completed ?? 0;
    const failed = experimentRunProgress?.failed ?? 0;

    // Don't show anything if total is 0 (progress not initialized yet)
    if (total === 0) {
      return null;
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <ProgressCircle
          value={percentage}
          size="S"
          aria-label="Experiment progress"
        />
        <Flex direction="row" gap="size-50">
          <Text color="text-700" size="S">
            {completed}/{total} completed
          </Text>
          {failed > 0 && (
            <Text color="danger" size="S">
              , {failed} failed
            </Text>
          )}
        </Flex>
      </Flex>
    );
  }
);
