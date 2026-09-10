import { z } from "zod";

import { defineUIOperation } from "../types";

const slot = z.enum(["A", "B", "C", "D"]);
const empty = z.strictObject({});
const availability = {
  routeHint:
    "Evaluator Playground only: /playground?mode=evaluators. Navigate with navigation.goTo, then read the workspace. Prompt playground.* and evaluator form evaluators.* operations do not control this workspace.",
};
const outputConfig = z.strictObject({
  name: z.string().min(1),
  optimizationDirection: z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]),
  values: z
    .array(
      z.strictObject({
        label: z.string().min(1),
        score: z.number().nullable().optional(),
      })
    )
    .min(2),
});
export const evaluatorSlotEditSchema = z.strictObject({
  slot,
  expectedRevision: z
    .string()
    .describe(
      "Revision returned by readSlot; rejects edits to a changed or replaced draft."
    ),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  inputMapping: z
    .strictObject({
      pathMapping: z.record(z.string(), z.string()),
      literalMapping: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()])
      ),
    })
    .optional(),
  outputConfigs: z
    .array(
      z.union([
        outputConfig,
        z.strictObject({
          kind: z.enum(["continuous", "freeform"]),
          name: z.string().min(1),
          optimizationDirection: z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]),
          lowerBound: z.number().nullable().optional(),
          upperBound: z.number().nullable().optional(),
          threshold: z.number().nullable().optional(),
        }),
      ])
    )
    .min(1)
    .optional(),
  selectedOutputName: z.string().optional(),
  includeExplanation: z.boolean().optional(),
  messages: z
    .array(
      z.strictObject({
        role: z.enum(["system", "user", "ai", "tool"]),
        content: z.string(),
      })
    )
    .min(1)
    .optional(),
  templateFormat: z.enum(["MUSTACHE", "F_STRING", "NONE"]).optional(),
  model: z
    .strictObject({
      provider: z.string(),
      customProviderId: z.string().nullable().optional(),
      name: z.string().min(1),
      invocationParameters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  language: z.enum(["PYTHON", "TYPESCRIPT"]).optional(),
  sourceCode: z.string().optional(),
  sandboxConfigId: z.string().optional(),
});
export type EvaluatorSlotEdit = z.infer<typeof evaluatorSlotEditSchema>;

export const readEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.read",
  operationKind: "read",
  availability,
  description:
    "Read evaluator mode, dataset/splits/sample size, slot summaries, run status, expected labels and paginated comparison results. Runs are temporary previews, not prompt experiments. All slots are peers with independent expected outputs. Use readSlot for editable draft details. No credentials are returned.",
  inputSchema: z.strictObject({
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  }),
});
export const configureEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.configure",
  operationKind: "write",
  availability,
  description:
    "Configure evaluator mode's dataset by Relay node ID, splits, sample size, comparison and result filter. Changing dataset/sample clears displayed results. Removing an unsaved slot requires discardChanges. Does not configure prompt playground or run anything.",
  inputSchema: z.strictObject({
    datasetId: z.string().nullable().optional(),
    splitIds: z.array(z.string()).optional(),
    sampleSize: z.number().int().min(1).max(500).optional(),
    compare: z.boolean().optional(),
    slots: z.array(slot).min(1).max(4).optional(),
    filter: z.enum(["all", "unreviewed", "errors", "disagreements"]).optional(),
    discardChanges: z.boolean().default(false),
  }),
});
export const selectEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.selectSlot",
  operationKind: "write",
  availability,
  description:
    "Load a saved global/dataset evaluator or a new LLM/code draft into explicit slot A, B, C or D. Configure visible slots before selecting one. Existing unsaved edits require discardChanges. Loading does not save. Call readSlot after loading.",
  inputSchema: z.strictObject({
    slot,
    source: z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("new"), kind: z.enum(["LLM", "CODE"]) }),
      z.strictObject({ type: z.literal("evaluator"), id: z.string() }),
      z.strictObject({ type: z.literal("datasetEvaluator"), id: z.string() }),
    ]),
    discardChanges: z.boolean().default(false),
  }),
});
export const readEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.readSlot",
  operationKind: "read",
  availability,
  description:
    "Read one explicitly targeted evaluator slot: revision, kind, name, prompt/model or code/language/sandbox, available sandboxes, output configs, mapping and validation. Read before editSlot or saveSlot. These slots are not numeric prompt instances or evaluator dialogs.",
  inputSchema: z.strictObject({ slot }),
});
export const editEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.editSlot",
  operationKind: "write",
  availability,
  description:
    "Edit exactly one evaluator draft with a readSlot revision. Only supplied fields change; lists/mappings replace their entire value. Prompt/messages/model/includeExplanation apply to LLM; code/language/sandbox to CODE. Outputs: LLM slots accept only categorical outputs (labels, each optionally scored — express a 0–1 scale as scored labels); continuous and freeform outputs are valid only for CODE slots and are rejected for LLM on run and save. Dataset output is the judged response; reference starts empty. Human expected labels never enter evaluator context. Does not save or run.",
  inputSchema: evaluatorSlotEditSchema,
});
export const runEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.run",
  operationKind: "write",
  longRunning: true,
  availability,
  description:
    "Run all visible evaluators (omit slots) or explicit A–D slots on the shared sample. Awaits completion and returns run status/results; calls LLMs or sandboxes and can incur cost. Unselected slot results remain unchanged. Does not save evaluators, create experiments, or write expected labels.",
  inputSchema: z.strictObject({
    slots: z.array(slot).min(1).max(4).optional(),
  }),
});
export const stopEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.stop",
  operationKind: "write",
  availability,
  description:
    "Stop evaluator sample scheduling and ignore late results. Already executing provider/sandbox requests may still finish. Does not stop prompt playground runs.",
  inputSchema: empty,
});
export const saveEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.saveSlot",
  operationKind: "write",
  longRunning: true,
  availability,
  description:
    "Explicitly save one evaluator slot as a NEW evaluator attached to the selected dataset using the UI validation/save path. Set a new name with editSlot first. Does not overwrite a saved evaluator. Requires the latest readSlot revision; returns the saved dataset-evaluator ID or an error.",
  inputSchema: z.strictObject({ slot, expectedRevision: z.string() }),
});
export const reviewEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.setExpectedOutput",
  operationKind: "write",
  availability,
  description:
    "Persist or clear an expected output on a sampled example for an explicit evaluator slot. Only record user-provided/confirmed ground truth; never silently promote your own or evaluator predictions to human labels. Require example revision and output name from read to prevent stale/mis-scoped review writes.",
  inputSchema: z.strictObject({
    slot,
    exampleId: z.string(),
    expectedRevisionId: z.string(),
    outputName: z.string(),
    label: z.string().nullable(),
    score: z.number().nullable().optional(),
    explanation: z.string().nullable().optional(),
  }),
});
export const evaluatorPlaygroundOperations = [
  readEvaluatorPlaygroundOperation,
  configureEvaluatorPlaygroundOperation,
  selectEvaluatorPlaygroundSlotOperation,
  readEvaluatorPlaygroundSlotOperation,
  editEvaluatorPlaygroundSlotOperation,
  runEvaluatorPlaygroundOperation,
  stopEvaluatorPlaygroundOperation,
  saveEvaluatorPlaygroundSlotOperation,
  reviewEvaluatorPlaygroundOperation,
];
