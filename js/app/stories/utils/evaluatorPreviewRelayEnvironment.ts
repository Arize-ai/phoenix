import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";

import type {
  EvaluatorPreviewInput,
  EvaluatorPreviewSubjectResult,
} from "@phoenix/components/evaluators/useEvaluatorPreview";

export type EvaluatorPreviewOutputResult =
  EvaluatorPreviewSubjectResult["results"][number];

/**
 * A Relay environment whose `evaluatorPreview` subscription answers every
 * subject with the same results, then ends the stream.
 */
export function createEvaluatorPreviewEnvironment(
  results: readonly EvaluatorPreviewOutputResult[]
) {
  return new Environment({
    network: Network.create(
      async () => ({ data: {} }),
      (_request, variables) =>
        Observable.create((sink) => {
          const { subjects } = variables.input as EvaluatorPreviewInput;
          for (const { key } of subjects) {
            sink.next({
              data: { evaluatorPreview: { key, error: null, results } },
            });
          }
          sink.complete();
        })
    ),
    store: new Store(new RecordSource()),
  });
}
