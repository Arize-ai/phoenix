import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export type LoadDatasetToolOutputSender = Chat<UIMessage>["addToolOutput"];

/**
 * Input schema for the load_dataset tool. Must agree with the server-owned
 * PARAMETERS (the model-facing source of truth): `datasetName` is a required
 * string and `splitName` is optional. v1 accepts at most one split.
 */
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

export const loadDatasetActionContextSchema = z.object({
  toolCallId: z.string(),
  sessionId: z.string(),
  addToolOutput: z.custom<LoadDatasetToolOutputSender>(
    (value) => typeof value === "function"
  ),
});
