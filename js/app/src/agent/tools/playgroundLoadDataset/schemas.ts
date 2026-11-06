import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

// Must agree with the server-owned PARAMETERS: datasetName required, splitName optional.
export const loadDatasetInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input == null ? {} : input, {
        datasetName: ["dataset_name"],
        splitName: ["split_name"],
      }),
    z.object({
      datasetName: z.string().trim().min(1),
      // The model may emit an explicit null to mean "no split"; treat it the
      // same as omitting the field, which loads the whole dataset.
      splitName: z.string().trim().min(1).nullable().optional(),
    })
  )
  .transform(({ datasetName, splitName }) => ({
    datasetName,
    ...(splitName != null ? { splitName } : {}),
  }));
