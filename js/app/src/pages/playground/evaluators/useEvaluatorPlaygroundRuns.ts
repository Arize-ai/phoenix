import { useEffect, useRef, useState } from "react";
import { commitMutation, graphql, useRelayEnvironment } from "react-relay";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useEvaluatorPlaygroundRunsPreviewMutation } from "./__generated__/useEvaluatorPlaygroundRunsPreviewMutation.graphql";
import type {
  SampleExample,
  EvaluatorPrediction,
  EvaluatorRun,
} from "./evaluatorResults";
import {
  createEvaluatorContext,
  getEvaluatorAnnotationName,
  runEvaluatorSample,
} from "./evaluatorResults";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";

/** One evaluator × row request of a run, with the frozen draft it evaluates. */
type SlotRequest = {
  slotId: SlotId;
  slot: SlotSnapshot;
  preview: NonNullable<SlotSnapshot["preview"]>;
  controller: AbortController;
  example: SampleExample;
};

/**
 * The page's runs: one preview request per evaluator × row, with a controller
 * per slot so a column can be stopped or started over on its own.
 */
export function useEvaluatorPlaygroundRuns({
  examples,
  slots,
  sampleKey,
  applyOnlineEvaluationLimits,
  concurrency,
}: {
  examples: SampleExample[];
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  sampleKey: string;
  /** Fail wherever a scheduled online run would; on for span rows. */
  applyOnlineEvaluationLimits: boolean;
  /** Rows evaluated at the same time. */
  concurrency: number;
}) {
  const environment = useRelayEnvironment();
  const credentials = useCredentialsContext((state) => state);
  const [runs, setRuns] = useState<Partial<Record<SlotId, EvaluatorRun>>>({});
  const controllers = useRef<Partial<Record<SlotId, AbortController>>>({});

  useEffect(
    () => () => {
      for (const controller of Object.values(controllers.current))
        controller?.abort();
    },
    []
  );

  /**
   * Run the given slots over the sample, or over just the given rows. A
   * whole-column run starts that column over; a row run keeps the column's
   * other results and replaces only the targeted rows.
   */
  async function runSlots(slotIds: SlotId[], exampleIds?: readonly string[]) {
    const targets = exampleIds
      ? examples.filter((example) => exampleIds.includes(example.id))
      : examples;

    const targetIds = new Set(targets.map((example) => example.id));
    // Freeze every slot before the first request, and share one concurrency budget.
    const requests: SlotRequest[] = [];

    for (const slotId of slotIds) {
      const slot = slots[slotId];
      const preview = slot?.preview;

      if (!slot || !preview || slot.validationError || !targets.length)
        continue;
      controllers.current[slotId]?.abort();
      const controller = new AbortController();
      controllers.current[slotId] = controller;
      setRuns((previous) => {
        const current = previous[slotId];

        const kept =
          exampleIds && current?.sampleKey === sampleKey
            ? Object.fromEntries(
                Object.entries(current.predictions).filter(
                  ([id]) => !targetIds.has(id)
                )
              )
            : {};

        return {
          ...previous,
          [slotId]: {
            revision: slot.revision,
            sampleKey,
            predictions: kept,
            queued: targets.map((example) => example.id),
            isRunning: true,
          },
        };
      });

      for (const example of targets)
        requests.push({ slotId, slot, preview, controller, example });
    }

    await runEvaluatorSample({
      items: requests,
      concurrency,
      execute: async ({ slot, preview, controller, example }) => {
        if (controller.signal.aborted)
          return { status: "error", error: "Stopped" };

        return new Promise<EvaluatorPrediction>((resolve) => {
          commitMutation<useEvaluatorPlaygroundRunsPreviewMutation>(
            environment,
            {
              mutation: graphql`
                mutation useEvaluatorPlaygroundRunsPreviewMutation(
                  $input: EvaluatorPreviewsInput!
                ) {
                  evaluatorPreviews(input: $input) {
                    results {
                      annotation {
                        name
                        label
                        score
                        explanation
                      }
                      error
                    }
                  }
                }
              `,
              variables: {
                input: {
                  previews: [
                    {
                      evaluator: preview,
                      context: createEvaluatorContext(example),
                      inputMapping: slot.inputMapping,
                      applyOnlineEvaluationLimits,
                    },
                  ],
                  credentials: toGqlCredentials(credentials),
                },
              },
              onCompleted(response, errors) {
                if (errors?.length) {
                  resolve({
                    status: "error",
                    error: errors.map((error) => error.message).join("\n"),
                  });

                  return;
                }

                resolve(
                  readPrediction(
                    slot,
                    preview,
                    response.evaluatorPreviews.results
                  )
                );
              },
              onError(error) {
                resolve({
                  status: "error",
                  error:
                    getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
                    error.message,
                });
              },
            }
          );
        });
      },
      onResult({ slotId, slot, controller, example }, prediction) {
        if (
          controller.signal.aborted ||
          controllers.current[slotId] !== controller
        )
          return;
        setRuns((previous) => {
          const run = previous[slotId];

          return run
            ? {
                ...previous,
                [slotId]: {
                  ...run,
                  predictions: {
                    ...run.predictions,
                    [example.id]: { ...prediction, revision: slot.revision },
                  },
                  queued: run.queued.filter((id) => id !== example.id),
                },
              }
            : previous;
        });
      },
    });

    for (const slotId of slotIds) {
      const request = requests.find((item) => item.slotId === slotId);

      if (request && controllers.current[slotId] === request.controller) {
        setRuns((previous) => {
          const run = previous[slotId];

          return run
            ? {
                ...previous,
                [slotId]: { ...run, isRunning: false, queued: [] },
              }
            : previous;
        });
      }
    }
  }

  function stop() {
    for (const controller of Object.values(controllers.current))
      controller?.abort();
    setRuns((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([slotId, run]) => [
          slotId,
          { ...run, isRunning: false, queued: [] },
        ])
      )
    );
  }

  return { runs, runSlots, stop };
}

/** The slot's selected output out of a preview's flattened results. */
function readPrediction(
  slot: SlotSnapshot,
  preview: NonNullable<SlotSnapshot["preview"]>,
  results: useEvaluatorPlaygroundRunsPreviewMutation["response"]["evaluatorPreviews"]["results"]
): EvaluatorPrediction {
  const outputCount =
    preview.inlineLlmEvaluator?.outputConfigs.length ??
    preview.inlineCodeEvaluator?.outputConfigs.length ??
    1;

  const annotationName = getEvaluatorAnnotationName({
    evaluatorName: slot.name,
    outputName: slot.selectedOutputName,
    outputCount,
  });

  const result = results.find(
    (item) => item.annotation?.name === annotationName
  );

  const annotation = result?.annotation;

  const validLabels =
    slot.outputNames.find((output) => output.name === slot.selectedOutputName)
      ?.labels ?? [];

  if (
    !annotation ||
    (validLabels.length > 0 && !validLabels.includes(annotation.label ?? ""))
  )
    return {
      status: "error",
      error:
        result?.error ??
        results.find((item) => item.error)?.error ??
        "Evaluator did not return a label from the selected output.",
    };

  return {
    status: "success",
    label: annotation.label,
    explanation: annotation.explanation,
    score: annotation.score,
  };
}
