import { useEffect } from "react";
import { useRelayEnvironment } from "react-relay";
import { commitMutation, graphql } from "relay-runtime";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { PlaygroundDecisionOutputMutation } from "./__generated__/PlaygroundDecisionOutputMutation.graphql";
import { buildDecisionInput } from "./decisionUtils";
import {
  denormalizePlaygroundInstance,
  getVariablesMapFromInstances,
} from "./playgroundUtils";

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

/**
 * Runs an instance's decision request against its model whenever
 * that instance gets a new active run. Repetitions are sequential and
 * non-streaming. Disposed or stale runs never overwrite a newer run.
 */
export function useDecisionRunner(instanceId: number) {
  const store = usePlaygroundStore();
  const environment = useRelayEnvironment();
  const credentials = useCredentialsContext((state) => state);
  const runId = usePlaygroundContext(
    (state) =>
      state.instances.find((item) => item.id === instanceId)?.activeRunId
  );

  useEffect(() => {
    if (runId == null) return undefined;
    const state = store.getState();
    const snapshot = state.instances.find((item) => item.id === instanceId);
    const decision = snapshot?.decisionRequest;
    if (!snapshot || !decision) return undefined;
    // Resolve template variables once per run so every repetition sends the
    // same evidence.
    const { variablesMap } = getVariablesMapFromInstances({
      instances: [
        denormalizePlaygroundInstance(snapshot, state.allInstanceMessages),
      ],
      templateFormat: state.templateFormat,
      input: state.input,
    });
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
          const input = buildDecisionInput(decision, {
            templateFormat: state.templateFormat,
            variables: variablesMap,
          });
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
}
