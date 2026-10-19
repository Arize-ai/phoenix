import { Suspense } from "react";

import {
  Alert,
  Button,
  Card,
  Flex,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";

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
  return (
    <Card title="Decision output">
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {Object.keys(instance.repetitions).length > 1 ? (
            <Flex direction="row" gap="size-100">
              {Object.keys(instance.repetitions).map((number) => (
                <Button
                  key={number}
                  size="S"
                  variant={
                    Number(number) === instance.selectedRepetitionNumber
                      ? "primary"
                      : "default"
                  }
                  onPress={() =>
                    store
                      .getState()
                      .setSelectedRepetitionNumber(instanceId, Number(number))
                  }
                >
                  Run {number}
                </Button>
              ))}
            </Flex>
          ) : null}
          {runId != null ? <Loading size="S" /> : null}
          {selected?.error ? (
            <div role="alert">
              <Alert variant="danger">{selected.error.message}</Alert>
            </div>
          ) : null}
          {typeof selected?.output === "string" ? (
            <DecisionResult output={selected.output} request={request} />
          ) : !selected?.error && runId == null ? (
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
