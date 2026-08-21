import {
  MAX_EVALUATOR_IDS,
  readDatasetEvaluatorDefinitionInputSchema,
} from "@phoenix/agent/tools/datasetEvaluatorDefinition";
import { openDatasetEvaluatorForEditInputSchema } from "@phoenix/agent/tools/datasetEvaluatorForEdit";
import { setDatasetEvaluatorSelectionInputSchema } from "@phoenix/agent/tools/datasetEvaluatorSelection";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Route hint shared by the dataset-evaluator operations: all of them act on
 * the playground's evaluator roster, which only exists when a dataset is
 * mounted in the playground.
 */
const DATASET_EVALUATOR_ROUTE_HINT =
  "the Prompt Playground page with a dataset loaded";

/**
 * The catalog entry replacing the `set_dataset_evaluator_selection`
 * client-action tool. The input schema is reused from the existing tool
 * module (`@phoenix/agent/tools/datasetEvaluatorSelection`); the description
 * moves here verbatim from the Python `DESCRIPTION`.
 */
export const selectDatasetEvaluatorsOperation = defineUiOperation({
  name: "evaluators.select",
  description:
    "Set which existing dataset evaluators are applied to the mounted playground " +
    "so they run in the next experiment. Use this when the user wants to choose, " +
    "add, or remove which evaluators score the dataset. Pass the complete desired " +
    "set of evaluator ids from the playground roster; this replaces the current " +
    "selection wholesale. It does not create, edit, or delete evaluators.",
  inputSchema: setDatasetEvaluatorSelectionInputSchema,
  kind: "write",
  defaultSuccessOutput: "Dataset evaluator selection updated.",
  availability: {
    routeHint: DATASET_EVALUATOR_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `open_dataset_evaluator_for_edit`
 * client-action tool. The input schema is reused from the existing tool
 * module (`@phoenix/agent/tools/datasetEvaluatorForEdit`); the description
 * moves here verbatim from the Python `DESCRIPTION`, with tool references
 * rewritten to operation names.
 */
export const openDatasetEvaluatorForEditOperation = defineUiOperation({
  name: "evaluators.openForEdit",
  description:
    "Open an existing dataset evaluator's edit form in the mounted playground " +
    "without navigating away. Use this when the user wants to change an existing " +
    "code or LLM evaluator's configuration. After it opens, use the draft " +
    "operations that appear to read and propose edits. Only code and LLM " +
    "evaluators are editable here; built-in evaluators are not supported. It " +
    "does not select which evaluators run or persist any change.",
  inputSchema: openDatasetEvaluatorForEditInputSchema,
  kind: "write",
  defaultSuccessOutput: "Evaluator edit form opened.",
  availability: {
    routeHint: DATASET_EVALUATOR_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `read_dataset_evaluator_definition`
 * client-action tool. The input schema is reused from the existing tool
 * module (`@phoenix/agent/tools/datasetEvaluatorDefinition`); the description
 * moves here verbatim from the Python `DESCRIPTION` (including the
 * `MAX_EVALUATOR_IDS` interpolation).
 */
export const readDatasetEvaluatorDefinitionOperation = defineUiOperation({
  name: "evaluators.readDefinition",
  description:
    "Read the full definition of one or a few existing dataset evaluators by id, " +
    "without opening any form. Use this to inspect an evaluator's body before " +
    "comparing, selecting, or proposing edits: code evaluators return source, " +
    "language, sandbox, and mappings; LLM evaluators return judge messages, model " +
    "config, and output configs; built-in evaluators return metadata, input " +
    "schema, and output configs. Pass evaluator ids from the playground roster; " +
    `read at most ${MAX_EVALUATOR_IDS} at a time. Long body fields may be ` +
    "truncated with a marker; open the evaluator for edit to read the full " +
    "source. It does not edit, select, or create evaluators.",
  inputSchema: readDatasetEvaluatorDefinitionInputSchema,
  kind: "read",
  defaultSuccessOutput: "Evaluator definitions read.",
  availability: {
    routeHint: DATASET_EVALUATOR_ROUTE_HINT,
  },
});

/**
 * All dataset-evaluator catalog entries, in roster order: select which
 * evaluators run, open one for editing, and read definitions without opening
 * a form.
 */
export const datasetEvaluatorOperations: UiOperationDescriptor[] = [
  selectDatasetEvaluatorsOperation,
  openDatasetEvaluatorForEditOperation,
  readDatasetEvaluatorDefinitionOperation,
];
