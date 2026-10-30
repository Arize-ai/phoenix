import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import type { Annotation } from "@phoenix/components/annotation";
import type {
  EvaluatorDefinitionInput,
  EvaluatorInputMappingInput,
  useEvaluatorPreviewMutation,
} from "@phoenix/components/evaluators/__generated__/useEvaluatorPreviewMutation.graphql";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { getMutationErrorMessage } from "@phoenix/utils/errorUtils";

/** The evaluator to preview and how its inputs read the mapping source. */
export type EvaluatorPreviewRequest = {
  evaluator: EvaluatorDefinitionInput;
  inputMapping: EvaluatorInputMappingInput;
};

export type EvaluatorPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

export type EvaluatorPreviewsOutput =
  useEvaluatorPreviewMutation["response"]["evaluatorPreviews"];

export type EvaluatorPreviewRunResult =
  | { ok: true; output: EvaluatorPreviewsOutput }
  | { ok: false; error: string };

/**
 * Runs one evaluator against the evaluator store's mapping source and holds
 * the results. Any evaluator kind previews through it: the caller builds the
 * evaluator definition, and a build that throws reports its message as the
 * preview error.
 */
export function useEvaluatorPreview() {
  const store = useEvaluatorStoreInstance();
  const credentials = useCredentialsContext((state) => state);
  const [results, setResults] = useState<EvaluatorPreviewResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [commit, isRunning] = useMutation<useEvaluatorPreviewMutation>(graphql`
    mutation useEvaluatorPreviewMutation($input: EvaluatorPreviewsInput!) {
      evaluatorPreviews(input: $input) {
        results {
          evaluatorName
          annotation {
            ...decisionAnnotation_annotation @relay(mask: false)
            explanation
            label
            score
            name
            id
          }
          error
        }
      }
    }
  `);

  const fail = (message: string): EvaluatorPreviewRunResult => {
    setError(message);
    return { ok: false, error: message };
  };

  const run = (
    buildRequest: () => EvaluatorPreviewRequest
  ): Promise<EvaluatorPreviewRunResult> => {
    setError(null);
    setResults([]);
    let request: EvaluatorPreviewRequest;
    try {
      request = buildRequest();
    } catch (buildError) {
      return Promise.resolve(fail(getMutationErrorMessage(buildError)));
    }
    return new Promise((resolve) => {
      commit({
        variables: {
          input: {
            previews: [
              {
                context: store.getState().evaluatorMappingSource.source,
                ...request,
              },
            ],
            credentials: toGqlCredentials(credentials),
          },
        },
        onCompleted(response, errors) {
          if (errors && errors.length > 0) {
            resolve(fail(errors.map(({ message }) => message).join("\n")));
            return;
          }
          setResults(
            response.evaluatorPreviews.results.map((result) =>
              result.error != null
                ? {
                    kind: "error",
                    evaluatorName: result.evaluatorName,
                    message: result.error,
                  }
                : result.annotation != null
                  ? { kind: "success", annotation: result.annotation }
                  : {
                      kind: "error",
                      evaluatorName: result.evaluatorName,
                      message: "The evaluator returned no annotation.",
                    }
            )
          );
          resolve({ ok: true, output: response.evaluatorPreviews });
        },
        onError(networkError) {
          resolve(fail(getMutationErrorMessage(networkError)));
        },
      });
    });
  };

  return {
    run,
    isRunning,
    results,
    error,
    clearResults: () => setResults([]),
    clearError: () => setError(null),
  };
}

export type EvaluatorPreview = ReturnType<typeof useEvaluatorPreview>;
