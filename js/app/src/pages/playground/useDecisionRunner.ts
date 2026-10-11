import { useEffect } from "react";
import { useRelayEnvironment } from "react-relay";
import { commitMutation, graphql } from "relay-runtime";

import { useCredentialsStore } from "@phoenix/contexts/CredentialsContext";
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

const FALLBACK_ERROR_MESSAGE =
  "Could not execute the decision request. Check the connection and provider configuration.";

/**
 * Runs an instance's decision request against its model whenever
 * that instance gets a new active run. Repetitions are sequential and
 * non-streaming. Disposed or stale runs never overwrite a newer run.
 */
export function useDecisionRunner(instanceId: number) {
  const store = usePlaygroundStore();
  // The store, not a subscription: credentials are read once when a run
  // starts, so a key edited mid-run never restarts that run.
  const credentialsStore = useCredentialsStore();
  const environment = useRelayEnvironment();
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
    // Resolve template variables and credentials once per run so every
    // repetition sends the same request.
    const { variablesMap } = getVariablesMapFromInstances({
      instances: [
        denormalizePlaygroundInstance(snapshot, state.allInstanceMessages),
      ],
      templateFormat: state.templateFormat,
      input: state.input,
    });
    const providerCredentials =
      credentialsStore.getState()[snapshot.model.provider] ?? {};
    const credentials = Object.entries(providerCredentials).flatMap(
      ([envVarName, value]) =>
        typeof value === "string" && value ? [{ envVarName, value }] : []
    );
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
          const input = buildDecisionInput({
            draft: decision,
            templateFormat: state.templateFormat,
            variables: variablesMap,
          });
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
                    credentials,
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
                // Relay's raw error string embeds the request variables,
                // credentials included. Surface only the GraphQL messages.
                onError: (error) =>
                  reject(
                    new Error(
                      getErrorMessagesFromRelayMutationError(error)?.join(
                        "\n"
                      ) ?? FALLBACK_ERROR_MESSAGE
                    )
                  ),
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
  }, [runId, instanceId, store, environment, credentialsStore]);
}
