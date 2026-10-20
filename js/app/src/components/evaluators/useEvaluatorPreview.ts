import { useCallback, useEffect, useRef } from "react";
import { graphql, useRelayEnvironment } from "react-relay";
import type { Disposable } from "relay-runtime";
import { requestSubscription } from "relay-runtime";

import type { Annotation } from "@phoenix/components/annotation";
import type {
  EvaluatorPreviewInput,
  useEvaluatorPreviewSubscription,
} from "@phoenix/components/evaluators/__generated__/useEvaluatorPreviewSubscription.graphql";
import { getErrorMessagesFromRelaySubscriptionError } from "@phoenix/utils/errorUtils";

export type { EvaluatorPreviewInput };

/** What the evaluator returned for one subject of a preview. */
export type EvaluatorPreviewSubjectResult =
  useEvaluatorPreviewSubscription["response"]["evaluatorPreview"];

const subscription = graphql`
  subscription useEvaluatorPreviewSubscription($input: EvaluatorPreviewInput!) {
    evaluatorPreview(input: $input) {
      id
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
export function useEvaluatorPreview() {
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

/**
 * A preview of one subject, as a promise: the dataset evaluator forms test the
 * selected example and wait for its verdict. Unmounting the form closes any
 * preview still running, so the server stops its work, and settles the promise
 * so nothing waits on it.
 */
export function useSingleSubjectEvaluatorPreview() {
  const startPreview = useEvaluatorPreview();
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
  return useCallback(
    (
      input: Omit<EvaluatorPreviewInput, "subjects"> & { context: unknown }
    ): Promise<
      | { ok: true; result: EvaluatorPreviewSubjectResult }
      | { ok: false; error: string }
    > => {
      const { context, ...rest } = input;
      return new Promise((resolve) => {
        let result: EvaluatorPreviewSubjectResult | null = null;
        let isSettled = false;
        const closeRunningPreviews = closeRunningPreviewsRef.current;
        const settle = (
          outcome:
            | { ok: true; result: EvaluatorPreviewSubjectResult }
            | { ok: false; error: string }
        ) => {
          isSettled = true;
          closeRunningPreviews.delete(close);
          resolve(outcome);
        };
        const preview = startPreview(
          { ...rest, subjects: [{ id: "subject", context }] },
          {
            onSubjectResult: (subjectResult) => {
              result = subjectResult;
            },
            onError: (error) => settle({ ok: false, error }),
            onCompleted: () =>
              settle(
                result == null
                  ? { ok: false, error: "The preview returned no result" }
                  : result.error != null
                    ? { ok: false, error: result.error }
                    : { ok: true, result }
              ),
          }
        );
        function close() {
          preview.dispose();
          settle({
            ok: false,
            error: "The evaluator form closed before the test finished",
          });
        }
        if (!isSettled) {
          closeRunningPreviews.add(close);
        }
      });
    },
    [startPreview]
  );
}

/** One output of a previewed evaluator, as the dataset forms show it. */
export type EvaluationPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

export function toEvaluationPreviewResults(
  result: EvaluatorPreviewSubjectResult
): EvaluationPreviewResult[] {
  return result.results.map((output) => {
    if (output.error != null) {
      return {
        kind: "error" as const,
        evaluatorName: output.evaluatorName,
        message: output.error,
      };
    } else if (output.annotation != null) {
      return {
        kind: "success" as const,
        annotation: {
          id: output.annotation.id,
          name: output.annotation.name,
          label: output.annotation.label,
          score: output.annotation.score,
          explanation: output.annotation.explanation,
        },
      };
    } else {
      throw new Error("Unknown error: no annotation or error returned");
    }
  });
}
