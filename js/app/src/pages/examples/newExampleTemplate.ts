import { blankJSONValue } from "@phoenix/utils/jsonUtils";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

export type NewExampleTemplate = Pick<
  DatasetExampleTableRow,
  "input" | "output" | "metadata"
>;

const EMPTY_TEMPLATE: NewExampleTemplate = {
  input: {},
  output: {},
  metadata: {},
};

/**
 * The starting input, output, and metadata for a new example: the keys of the
 * dataset's first saved example with their values cleared, so the person fills
 * in blanks instead of retyping the dataset's structure. An empty dataset
 * starts from empty objects.
 */
export function getNewExampleTemplate(
  rows: readonly DatasetExampleTableRow[]
): NewExampleTemplate {
  const sampleRow = rows.find((row) => !row.isNew);
  if (!sampleRow) {
    return EMPTY_TEMPLATE;
  }
  return {
    input: blankJSONValue(sampleRow.input) as Record<string, unknown>,
    output: blankJSONValue(sampleRow.output) as Record<string, unknown>,
    metadata: blankJSONValue(sampleRow.metadata) as Record<string, unknown>,
  };
}
