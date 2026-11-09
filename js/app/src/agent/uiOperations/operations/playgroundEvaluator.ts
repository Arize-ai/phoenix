import { z } from "zod";

import {
  editEvaluatorTaskInputSchema,
  readEvaluatorTaskInputSchema,
  saveEvaluatorTaskInputSchema,
  setExpectedOutputInputSchema,
} from "@phoenix/agent/tools/playgroundEvaluator/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";
import { PLAYGROUND_ROUTE_HINT } from "./playgroundRouteHints";

/**
 * Documentation-only mirror of `EvaluatorTaskRead` — what
 * `playground.evaluator.read` resolves with. Approximate on purpose (see
 * `outputSchema` on the descriptor type): the top-level field names are what
 * scripts branch on.
 */
export const evaluatorTaskReadOutputSchema = z.object({
  instanceId: z.number(),
  index: z.number(),
  label: z.string(),
  revision: z.string(),
  dirty: z.boolean(),
  kind: z.enum(["LLM", "CODE"]),
  name: z.string(),
  description: z.string(),
  annotationName: z.string(),
  inputMapping: z.object({
    pathMapping: z.record(z.string(), z.string()),
    literalMapping: z.record(z.string(), z.unknown()),
  }),
  outputConfigs: z.array(z.unknown()),
  includeExplanation: z.boolean().optional(),
  code: z
    .object({
      language: z.string(),
      sourceCode: z.string(),
      sandboxConfigId: z.string().nullable(),
    })
    .nullable(),
  source: z.object({
    evaluatorId: z.string().nullable(),
    datasetEvaluatorId: z.string().nullable(),
    projectEvaluatorId: z.string().nullable(),
  }),
  datasetId: z.string().nullable(),
  saveTarget: z.object({
    action: z.enum(["create", "attach", "update"]),
    evaluatorId: z.string().optional(),
    datasetEvaluatorId: z.string().optional(),
  }),
  validationError: z.string().nullable(),
  availableSandboxConfigs: z
    .array(z.object({ id: z.string(), name: z.string(), language: z.string() }))
    .optional(),
  outputConfigRules: z.string(),
});

export const readEvaluatorTaskOperation = defineUIOperation({
  name: "playground.evaluator.read",
  description:
    "Read one evaluator task: its `kind` (LLM or CODE), `name`, `description`, " +
    "`annotationName` (what its runs write and what expected outputs are recorded " +
    "under), `inputMapping`, `outputConfigs`, `includeExplanation` (LLM), `code` " +
    "{language, sourceCode, sandboxConfigId} with `availableSandboxConfigs` (CODE), " +
    "`source` (the saved evaluator it was loaded from, ids null for a draft), " +
    "`datasetId`, `saveTarget` (what `playground.evaluator.save` will do: create a " +
    "new dataset evaluator, attach a shared code evaluator to the dataset, or update " +
    "the loaded evaluator), `validationError` (why it cannot run or save yet, else " +
    "null), `outputConfigRules`, and the `revision` that `playground.evaluator.edit` " +
    "and `playground.evaluator.save` require. The judge prompt of an LLM evaluator is " +
    "the instance's own prompt: read and edit it with `playground.prompt.read`, " +
    "`playground.prompt.edit` and `playground.prompt.tools.read`, and change its " +
    "model with `playground.model.set`. `instanceId` may be omitted when the page " +
    "has exactly one instance. A prompt task fails with code NOT_FOUND: read it with " +
    "`playground.prompt.read`.",
  inputSchema: readEvaluatorTaskInputSchema,
  outputSchema: evaluatorTaskReadOutputSchema,
  operationKind: "read",
  defaultSuccessOutput: "Evaluator task read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

export const editEvaluatorTaskOperation = defineUIOperation({
  name: "playground.evaluator.edit",
  description:
    "Edit one evaluator task's configuration; the judge prompt of an LLM evaluator " +
    "is edited with `playground.prompt.edit` instead. Pass the latest " +
    "`expectedRevision` from `playground.evaluator.read` or from the previous edit's " +
    "result; a mismatch fails with code STALE_REVISION and the message carries the " +
    "current revision. Only supplied fields change; `inputMapping` and " +
    "`outputConfigs` replace their whole value. The whole patch is validated before " +
    "anything is applied: `includeExplanation` applies to LLM tasks only; `language`, " +
    "`sourceCode` and `sandboxConfigId` to CODE tasks only; a saved code evaluator " +
    'keeps its language (only a task whose saveTarget.action is "create" may switch); ' +
    "the sandbox must be one of `availableSandboxConfigs` for the language (changing " +
    "the language without a sandbox picks a compatible one). Outputs: LLM tasks " +
    "accept only categorical outputs — labels, each optionally scored; express a " +
    "0–1 scale as scored labels such as poor=0, fair=0.5, good=1 — while continuous " +
    "and freeform outputs are valid for CODE tasks only. Examples: " +
    '{instanceId:1,expectedRevision:"…",name:"tone",outputConfigs:[{name:"tone",' +
    'optimizationDirection:"MAXIMIZE",values:[{label:"friendly",score:1},' +
    '{label:"curt",score:0}]}]}; ' +
    '{instanceId:1,expectedRevision:"…",inputMapping:{pathMapping:{output:"output.answer"},' +
    "literalMapping:{}}}; " +
    '{instanceId:1,expectedRevision:"…",language:"TYPESCRIPT",sandboxConfigId:"…",' +
    'sourceCode:"…"}. Returns the new read. Does not save or run.',
  inputSchema: editEvaluatorTaskInputSchema,
  outputSchema: evaluatorTaskReadOutputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Evaluator task edited.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

export const saveEvaluatorTaskOperation = defineUIOperation({
  name: "playground.evaluator.save",
  description:
    "Save one evaluator task: the Save button's write. `saveTarget` from " +
    "`playground.evaluator.read` says what happens: `update` overwrites the " +
    "evaluator loaded into the task, `attach` updates a shared code evaluator and " +
    "adds it to the dataset, `create` saves a new dataset evaluator (a name is " +
    "required: set it with `playground.evaluator.edit` first). Requires a dataset " +
    "(`playground.dataset.load`) and a task with no `validationError`. Pass the " +
    "latest `expectedRevision`; a mismatch fails with code STALE_REVISION. " +
    '`asNew: true` is the dialog\'s "Save as new": it leaves the loaded evaluator ' +
    "unchanged and creates a copy named after the task with a `_copy` suffix. " +
    'Returns {datasetEvaluatorId, action: "created"|"updated", name}, where `name` ' +
    "is the saved name. Use it only when the user asks to save the evaluator.",
  inputSchema: saveEvaluatorTaskInputSchema,
  outputSchema: z.object({
    datasetEvaluatorId: z.string(),
    action: z.enum(["created", "updated"]),
    name: z.string(),
  }),
  operationKind: "write",
  // Awaits the save mutations.
  longRunning: true,
  defaultSuccessOutput: "Evaluator task saved.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

export const setExpectedOutputOperation = defineUIOperation({
  name: "playground.expectedOutput.set",
  description:
    "Record, or clear, the expected output of one loaded dataset example for an " +
    "evaluator task, as a HUMAN annotation named after the task's `annotationName` " +
    "(this writes a new dataset version). Only record ground truth the user " +
    "provided or confirmed; never promote your own or the evaluator's verdict to an " +
    "expected output. Take `exampleId` and `expectedRevisionId` (the example's " +
    "current `revisionId`) from `playground.experiment.readResults` after a run; a " +
    "stale revision fails with code STALE_REVISION. `label` must be one of the " +
    "output's labels for a categorical output; `label`, `score` and `explanation` " +
    "all null clears the expected output. Writes at once, without the table's " +
    "batching delay, and returns {exampleId, annotationName, saved}. Available only " +
    "while the playground shows a dataset. Example: " +
    '{instanceId:1,exampleId:"RGF0YXNldEV4YW1wbGU6NQ==",' +
    'expectedRevisionId:"RGF0YXNldEV4YW1wbGVSZXZpc2lvbjo5",label:"pass"}.',
  inputSchema: setExpectedOutputInputSchema,
  outputSchema: z.object({
    exampleId: z.string(),
    annotationName: z.string(),
    saved: z.number().optional(),
  }),
  operationKind: "write",
  defaultSuccessOutput: "Expected output recorded.",
  availability: {
    routeHint: `${PLAYGROUND_ROUTE_HINT} with a dataset loaded`,
  },
});

/** All playground evaluator-task operations, for catalog assembly. */
export const playgroundEvaluatorOperations: UIOperationDescriptor[] = [
  readEvaluatorTaskOperation,
  editEvaluatorTaskOperation,
  saveEvaluatorTaskOperation,
  setExpectedOutputOperation,
];
