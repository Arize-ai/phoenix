import { z } from "zod";

// Must agree with the server-owned PARAMETERS (add_spans_to_dataset.py): a
// required dataset name and optional span ids. When spanIds are omitted, the
// span in view (from context) is used.
export const addSpansToDatasetInputSchema = z.object({
  datasetName: z.string().trim().min(1),
  spanIds: z.array(z.string().min(1)).optional(),
});
