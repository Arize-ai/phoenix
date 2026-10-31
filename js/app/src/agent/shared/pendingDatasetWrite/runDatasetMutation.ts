import { commitMutation, type GraphQLTaggedNode } from "react-relay";
import type { MutationParameters, VariablesOf } from "relay-runtime";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { DatasetWriteApplyResult } from "./types";

/**
 * Run a Relay mutation and resolve to a {@link DatasetWriteApplyResult}: the
 * shared error-extraction + ok/error wrapping that every dataset-write commit
 * function needs. Pass `onSuccess` to build the success message from the typed
 * response; it may be async (for example to refetch a root list before the
 * result is reported). Generic over the relay-generated mutation type, so
 * variables and response stay fully type-checked at the call site.
 */
export function runDatasetMutation<T extends MutationParameters>({
  mutation,
  variables,
  onSuccess,
}: {
  mutation: GraphQLTaggedNode;
  variables: VariablesOf<T>;
  onSuccess: (response: T["response"]) => string | Promise<string>;
}): Promise<DatasetWriteApplyResult> {
  return new Promise((resolve) => {
    commitMutation<T>(RelayEnvironment, {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          resolve({ ok: false, error: message });
          return;
        }
        void Promise.resolve(onSuccess(response)).then(
          (output) => resolve({ ok: true, output }),
          (error: unknown) =>
            resolve({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            })
        );
      },
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}
