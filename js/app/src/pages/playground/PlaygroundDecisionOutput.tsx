import { Suspense } from "react";

import {
  Alert,
  Card,
  Flex,
  ParagraphSkeleton,
  Text,
  View,
} from "@phoenix/components";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { ExperimentRepetitionSelector } from "@phoenix/pages/experiment/ExperimentRepetitionSelector";

import { DecisionResult } from "./DecisionResult";
import { RunMetadataFooter } from "./RunMetadataFooter";
import type { PlaygroundInstanceProps } from "./types";
import { useDecisionRunner } from "./useDecisionRunner";

/**
 * Output for one decision instance. Runs the shared request against this
 * instance's model and shows every answer as a distribution.
 */
export function PlaygroundDecisionOutput({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  useDecisionRunner(instanceId);
  const store = usePlaygroundStore();
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const request = usePlaygroundContext((state) => state.decisionRequest);
  if (!instance) return null;
  const runId = instance.activeRunId;
  const selected = instance.repetitions[instance.selectedRepetitionNumber];
  const totalRepetitions = Object.keys(instance.repetitions).length;
  const skeletonLines = Math.max(1, request?.questions.length ?? 0);
  return (
    <Card
      title="Decision output"
      extra={
        totalRepetitions > 1 ? (
          <ExperimentRepetitionSelector
            repetitionNumber={instance.selectedRepetitionNumber}
            totalRepetitions={totalRepetitions}
            setRepetitionNumber={(next) =>
              store
                .getState()
                .setSelectedRepetitionNumber(
                  instanceId,
                  typeof next === "function"
                    ? next(instance.selectedRepetitionNumber)
                    : next
                )
            }
          />
        ) : undefined
      }
    >
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {selected?.error ? (
            <div role="alert">
              <Alert variant="danger">{selected.error.message}</Alert>
            </div>
          ) : null}
          {typeof selected?.output === "string" ? (
            <DecisionResult output={selected.output} request={request} />
          ) : runId != null && !selected?.error ? (
            <ParagraphSkeleton lines={skeletonLines * 2} />
          ) : !selected?.error ? (
            <Text color="text-700">
              Run the decision model to see each answer&rsquo;s probabilities,
              confidence, and usage.
            </Text>
          ) : null}
        </Flex>
      </View>
      {selected?.spanId ? (
        <Suspense>
          <RunMetadataFooter spanId={selected.spanId} hideTokenMetrics />
        </Suspense>
      ) : null}
    </Card>
  );
}
