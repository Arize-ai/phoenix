import { useCallback, useEffect, useRef, useState } from "react";
import { graphql, useRelayEnvironment } from "react-relay";
import type { Disposable } from "relay-runtime";
import { requestSubscription } from "relay-runtime";

import type { Annotation } from "@phoenix/components/annotation";
import type {
  EvaluatorDefinitionInput,
  EvaluatorInputMappingInput,
  EvaluatorPreviewInput,
  useEvaluatorPreviewSubscription,
} from "@phoenix/components/evaluators/__generated__/useEvaluatorPreviewSubscription.graphql";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import {
  getErrorMessagesFromRelaySubscriptionError,
  getMutationErrorMessage,
} from "@phoenix/utils/errorUtils";

export type { EvaluatorPreviewInput };

/** What the evaluator returned for one subject of a preview. */
export type EvaluatorPreviewSubjectResult =
  useEvaluatorPreviewSubscription["response"]["evaluatorPreview"];

const subscription = graphql`
  subscription useEvaluatorPreviewSubscription($input: EvaluatorPreviewInput!) {
    evaluatorPreview(input: $input) {
      key
      error
      results {
        evaluatorName
        annotation {
          ...decisionAnnotation_annotation @relay(mask: false)
          id
          name
          label
          score
          explanation
        }
        error
      }
    }
  }
`;

export type EvaluatorPreviewHandlers = {
  /** One subject finished; subjects report in the order they finish. */
  onSubjectResult: (result: EvaluatorPreviewSubjectResult) => void;
  /**
   * The preview could not run at all: the definition is invalid, or the
   * connection failed. It is the same for every subject, so it arrives once.
   */
  onError: (message: string) => void;
  /** Every subject has reported. */
  onCompleted?: () => void;
};

/**
 * Runs one evaluator definition against many subjects over the
 * `evaluatorPreview` subscription. Disposing the returned handle closes the
 * stream, and the server stops the subjects still running.
 */
export function useEvaluatorPreviewStream() {
  const environment = useRelayEnvironment();
  return useCallback(
    (
      input: EvaluatorPreviewInput,
      { onSubjectResult, onError, onCompleted }: EvaluatorPreviewHandlers
    ): Disposable =>
      requestSubscription<useEvaluatorPreviewSubscription>(environment, {
        subscription,
        variables: { input },
        onNext: (response) => {
          if (response) {
            onSubjectResult(response.evaluatorPreview);
          }
        },
        onCompleted,
        onError: (error) => {
          const messages = getErrorMessagesFromRelaySubscriptionError(error);
          onError(
            messages != null && messages.length > 0
              ? messages.join("\n")
              : error.message || "An unknown error occurred"
          );
        },
      }),
    [environment]
  );
}

/** The evaluator to preview and how its inputs read the mapping source. */
export type EvaluatorPreviewRequest = {
  evaluator: EvaluatorDefinitionInput;
  inputMapping: EvaluatorInputMappingInput;
};

type EvaluatorPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

type EvaluatorPreviewOutput = {
  results: EvaluatorPreviewSubjectResult["results"];
};

type EvaluatorPreviewRunResult =
  | { ok: true; output: EvaluatorPreviewOutput }
  | { ok: false; error: string };

function toEvaluatorPreviewResults(
  output: EvaluatorPreviewOutput
): EvaluatorPreviewResult[] {
  return output.results.map((result) =>
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
  );
}

/**
 * Runs one evaluator against the evaluator store's mapping source, as a
 * preview with a single subject, and holds the results. Any evaluator kind
 * previews through it: the caller builds the evaluator definition, and a
 * build that throws reports its message as the preview error.
 *
 * Unmounting the form closes any preview still running, so the server stops
 * its work, and settles the run so nothing (such as the agent's test tool)
 * waits on it.
 */
export function useEvaluatorPreview() {
  const store = useEvaluatorStoreInstance();
  const credentials = useCredentialsContext((state) => state);
  const startPreview = useEvaluatorPreviewStream();
  const [results, setResults] = useState<EvaluatorPreviewResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const closeRunningPreviewsRef = useRef(new Set<() => void>());
  useEffect(() => {
    const closeRunningPreviews = closeRunningPreviewsRef.current;
    return () => {
      for (const close of closeRunningPreviews) {
        close();
      }
      closeRunningPreviews.clear();
    };
  }, []);

  const run = useCallback(
    (
      buildRequest: () => EvaluatorPreviewRequest
    ): Promise<EvaluatorPreviewRunResult> => {
      const fail = (message: string): EvaluatorPreviewRunResult => {
        setError(message);
        return { ok: false, error: message };
      };
      setError(null);
      setResults([]);
      let request: EvaluatorPreviewRequest;
      try {
        request = buildRequest();
      } catch (buildError) {
        return Promise.resolve(fail(getMutationErrorMessage(buildError)));
      }
      setIsRunning(true);
      return new Promise((resolve) => {
        let subjectResult: EvaluatorPreviewSubjectResult | null = null;
        let isSettled = false;
        const closeRunningPreviews = closeRunningPreviewsRef.current;
        const settle = (outcome: EvaluatorPreviewRunResult) => {
          isSettled = true;
          closeRunningPreviews.delete(close);
          setIsRunning(false);
          resolve(outcome);
        };
        const preview = startPreview(
          {
            ...request,
            subjects: [
              {
                key: "subject",
                context: store.getState().evaluatorMappingSource.source,
              },
            ],
            credentials: toGqlCredentials(credentials),
          },
          {
            onSubjectResult: (result) => {
              subjectResult = result;
            },
            onError: (message) => settle(fail(message)),
            onCompleted: () => {
              if (subjectResult == null) {
                settle(fail("The preview returned no result"));
              } else if (subjectResult.error != null) {
                settle(fail(subjectResult.error));
              } else {
                const output = { results: subjectResult.results };
                setResults(toEvaluatorPreviewResults(output));
                settle({ ok: true, output });
              }
            },
          }
        );
        // The form is gone, so there is no state left to update.
        function close() {
          isSettled = true;
          closeRunningPreviews.delete(close);
          preview.dispose();
          resolve({
            ok: false,
            error: "The evaluator form closed before the test finished",
          });
        }
        if (!isSettled) {
          closeRunningPreviews.add(close);
        }
      });
    },
    [startPreview, store, credentials]
  );

  return {
    run,
    isRunning,
    results,
    error,
    clearResults: useCallback(() => setResults([]), []),
    clearError: useCallback(() => setError(null), []),
  };
}

export type EvaluatorPreview = ReturnType<typeof useEvaluatorPreview>;
