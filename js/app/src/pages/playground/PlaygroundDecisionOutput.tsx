import { Suspense, useEffect } from "react";
import { useRelayEnvironment } from "react-relay";
import { commitMutation, graphql } from "relay-runtime";

import {
  Alert,
  Button,
  Card,
  Flex,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { PlaygroundDecisionOutputMutation } from "./__generated__/PlaygroundDecisionOutputMutation.graphql";
import { DecisionResult } from "./DecisionResult";
import { buildDecisionInput } from "./decisionUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import type { PlaygroundInstanceProps } from "./types";

const mutation = graphql`
  mutation PlaygroundDecisionOutputMutation($input: CreateDecisionInput!) {
    createDecision(input: $input) {
      result
      error
      span {
        id
        trace {
          traceId
        }
      }
    }
  }
`;

function getDecisionNetworkErrorMessage(error: Error): string {
  // The network layer embeds variables before the final GraphQL errors array.
  // Search only that array: structured state can itself contain a `message` key.
  const errorsOffset = error.message.lastIndexOf("': [");
  const messages =
    errorsOffset >= 0
      ? getErrorMessagesFromRelayMutationError({
          message: error.message.slice(errorsOffset + 3),
        })
      : null;
  return (
    messages?.join("\n") ??
    "Could not execute the decision request. Check the connection and provider configuration."
  );
}

/** Repetitions are non-streaming. Disposed/stale runs never overwrite a newer run. */
export function PlaygroundDecisionOutput({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const store = usePlaygroundStore();
  const environment = useRelayEnvironment();
  const credentials = useCredentialsContext((state) => state);
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const runId = instance?.activeRunId;
  useEffect(() => {
    if (runId == null) return undefined;
    const snapshot = store
      .getState()
      .instances.find((item) => item.id === instanceId);
    if (!snapshot?.decision) return undefined;
    const decision = snapshot.decision;
    let isDisposed = false;
    const disposables: Array<{ dispose(): void }> = [];
    const pendingResolutions = new Set<() => void>();
    const isCurrent = () =>
      !isDisposed &&
      store
        .getState()
        .instances.some(
          (item) => item.id === instanceId && item.activeRunId === runId
        );
    const execute = async () => {
      for (const repetitionKey of Object.keys(snapshot.repetitions)) {
        if (!isCurrent()) return;
        const repetitionNumber = Number(repetitionKey);
        const actions = store.getState();
        actions.setRepetitionStatus(instanceId, repetitionNumber, "pending");
        try {
          const input = buildDecisionInput(decision);
          const providerCredentials =
            credentials[snapshot.model.provider] ?? {};
          await new Promise<void>((resolve, reject) => {
            const complete = () => {
              pendingResolutions.delete(complete);
              resolve();
            };
            pendingResolutions.add(complete);
            disposables.push(
              commitMutation<PlaygroundDecisionOutputMutation>(environment, {
                mutation,
                variables: {
                  input: {
                    ...input,
                    modelName: snapshot.model.modelName ?? "",
                    providerKey: snapshot.model.provider,
                    baseUrl: snapshot.model.baseUrl,
                    credentials: Object.entries(providerCredentials).flatMap(
                      ([envVarName, value]) =>
                        typeof value === "string" && value
                          ? [{ envVarName, value }]
                          : []
                    ),
                  },
                },
                onCompleted: (response, errors) => {
                  if (!isCurrent()) {
                    complete();
                    return;
                  }
                  const payload = response.createDecision;
                  if (errors?.length) {
                    reject(
                      new Error(errors.map((error) => error.message).join("\n"))
                    );
                    return;
                  }
                  if (payload.span) {
                    actions.setRepetitionSpanId(
                      instanceId,
                      repetitionNumber,
                      payload.span.id
                    );
                    actions.setRepetitionTraceId(
                      instanceId,
                      repetitionNumber,
                      payload.span.trace.traceId
                    );
                  }
                  if (payload.error) {
                    reject(new Error(payload.error));
                    return;
                  }
                  actions.appendRepetitionOutput(
                    instanceId,
                    repetitionNumber,
                    JSON.stringify(payload.result, null, 2)
                  );
                  complete();
                },
                // Relay's raw error string embeds request variables, including credentials.
                // Surface only GraphQL messages, never the raw network error.
                onError: (error) =>
                  reject(new Error(getDecisionNetworkErrorMessage(error))),
              })
            );
          });
        } catch (error) {
          if (isCurrent())
            actions.setRepetitionError(instanceId, repetitionNumber, {
              title: "Decision failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Decision execution failed",
            });
        }
        if (isCurrent())
          actions.setRepetitionStatus(instanceId, repetitionNumber, "finished");
      }
      if (isCurrent())
        store.getState().markPlaygroundInstanceComplete(instanceId);
    };
    void execute();
    return () => {
      isDisposed = true;
      for (const disposable of disposables) disposable.dispose();
      for (const resolve of pendingResolutions) resolve();
    };
  }, [runId, instanceId, store, environment, credentials]);
  if (!instance) return null;
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
            <DecisionResult output={selected.output} />
          ) : !selected?.error && runId == null ? (
            <Text color="text-700">
              Run the decision model to see named answers, confidence, and
              usage.
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
