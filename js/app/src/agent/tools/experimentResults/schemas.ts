import { z } from "zod";

/**
 * Input schema for `playground.experiment.readResults`. The single schema
 * definition — the descriptor derives the model-facing signature and dispatch
 * derives the runtime validator from it.
 */
export const readExperimentResultsInputSchema = z.strictObject({
  experimentId: z
    .string()
    .min(1)
    .describe(
      "Experiment node id — e.g. one of the `experimentIds` returned by " +
        "`playground.run` when the run recorded experiments."
    ),
  failuresOnly: z
    .boolean()
    .optional()
    .describe(
      "When true, return only runs that errored or received an annotation " +
        "score below 1 — the set to inspect before the next iteration."
    ),
});

export type ReadExperimentResultsInput = z.infer<
  typeof readExperimentResultsInputSchema
>;
