import { z } from "zod";

import { formatSpanFilterExampleSummary } from "@phoenix/pages/project/spanFilterHelp";

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

/** The options `saveSlot` passes through to the slot's save, revision aside. */
export type EvaluatorSlotSaveInput = Omit<
  z.infer<typeof saveEvaluatorPlaygroundSlotOperation.inputSchema>,
  "slot" | "expectedRevision"
>;

export const readEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.read",
  operationKind: "read",
  availability,
  description:
    "Read evaluator mode: the source (a dataset with splits, or a project with a span filter), sample size, slot summaries, run status, expected outputs and paginated comparison rows. Rows are dataset examples or spans (span id as id and revisionId). Runs are temporary previews, not prompt experiments. All slots are peers with independent expected outputs. Use readSlot for editable draft details. No credentials are returned.",
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
    "Configure evaluator mode's source and view: a dataset (Relay node ID) with splits, or a project (projectId, or projectName to resolve the exact name) with a span filterCondition — rows are then the most recent matching spans, capped by sampleSize. Setting a project clears the dataset and vice versa; changing the source or sample size clears displayed results. Also sets visible slots and the result filter. The filter is validated against the project before it is applied; an invalid one is rejected with the server's message and nothing changes. Removing an unsaved slot requires discardChanges. Does not configure prompt playground or run anything.",
  inputSchema: z.strictObject({
    datasetId: z.string().nullable().optional(),
    splitIds: z.array(z.string()).optional(),
    projectId: z
      .string()
      .nullable()
      .optional()
      .describe("Project Relay node ID; null clears the source."),
    projectName: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Exact project name, resolved to its ID for you. Use instead of projectId when you only know the name."
      ),
    filterCondition: z
      .string()
      .optional()
      .describe(
        `Span filter DSL for a project source; empty string for every span. Same dialect as spansFilter.set, e.g. ${formatSpanFilterExampleSummary()}. readFilterHelp lists the fields, idioms and this project's annotation and model names.`
      ),
    sampleSize: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("How many rows to load: examples, or most recent spans."),
    slots: z.array(slot).min(1).max(4).optional(),
    filter: z
      .enum(["all", "missing-expected", "errors", "disagreements"])
      .optional(),
    discardChanges: z.boolean().default(false),
  }),
});

export const readEvaluatorPlaygroundFilterHelpOperation = defineUIOperation({
  name: "evaluatorPlayground.readFilterHelp",
  operationKind: "read",
  availability,
  description:
    "Read the span filter DSL reference for configure's filterCondition: the fields an expression may reference, dialect notes (units, casing, attribute and annotation access), request→expression examples, and — when a project is the source — that project's annotation names and model names, so filters use names that exist. Call it before writing a filter that names an annotation, attribute or model, or after configure rejected one.",
  inputSchema: empty,
});

export const selectEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.selectSlot",
  operationKind: "write",
  availability,
  description:
    "Load a saved global, dataset or project evaluator (by Relay node ID), or a new LLM/code draft, into explicit slot A, B, C or D. Configure visible slots before selecting one. Existing unsaved edits require discardChanges. Loading does not save. Returns the same snapshot as readSlot, revision included, so edit next without re-reading.",
  inputSchema: z.strictObject({
    slot,
    source: z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("new"), kind: z.enum(["LLM", "CODE"]) }),
      z.strictObject({ type: z.literal("evaluator"), id: z.string() }),
      z.strictObject({ type: z.literal("datasetEvaluator"), id: z.string() }),
      z.strictObject({ type: z.literal("projectEvaluator"), id: z.string() }),
    ]),
    discardChanges: z.boolean().default(false),
  }),
});

export const readEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.readSlot",
  operationKind: "read",
  availability,
  description:
    "Read one explicitly targeted evaluator slot: revision, kind, name, prompt/model or code/language/sandbox, available sandboxes, output configs, mapping, saveTarget and, for a loaded project evaluator, its stored filter and sampling rate. Read before editSlot or saveSlot unless you hold the revision from selectSlot or editSlot. These slots are not numeric prompt instances or evaluator dialogs.",
  inputSchema: z.strictObject({ slot }),
});

export const editEvaluatorPlaygroundSlotOperation = defineUIOperation({
  name: "evaluatorPlayground.editSlot",
  operationKind: "write",
  availability,
  description:
    "Edit exactly one evaluator draft with a readSlot revision. Only supplied fields change; lists/mappings replace their entire value. Prompt/messages/model/includeExplanation apply to LLM; code/language/sandbox to CODE. Outputs: LLM slots accept only categorical outputs (labels, each optionally scored — express a 0–1 scale as scored labels); continuous and freeform outputs are valid only for CODE slots and are rejected for LLM on run and save. A row's output is the judged response; reference starts empty. Span rows expose the span's metadata (attributes included) to the mapping. Human expected labels never enter evaluator context. Does not save or run.",
  inputSchema: evaluatorSlotEditSchema,
});

export const runEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.run",
  operationKind: "write",
  longRunning: true,
  availability,
  description:
    "Run all visible evaluators (omit slots) or explicit A–D slots on the shared sample, or on only the given exampleIds (a row run keeps the other rows' results). Awaits completion and returns run status/results; calls LLMs or sandboxes and can incur cost. Unselected slot results remain unchanged. Does not save evaluators, create experiments, or write expected labels.",
  inputSchema: z.strictObject({
    slots: z.array(slot).min(1).max(4).optional(),
    exampleIds: z.array(z.string()).min(1).optional(),
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
    "Explicitly save one evaluator slot through the UI validation/save path. readSlot's saveTarget says what happens: update overwrites the evaluator loaded into the slot, attach updates a shared code evaluator and adds it to the selected dataset or project, create saves a NEW dataset evaluator or online project (span) evaluator (set a name with editSlot first; asNew forces a copy under a fresh name). On a project source the saved evaluator takes the current span filter and 100% sampling unless it was loaded from a project evaluator; filterCondition and samplingRate override that (pass filterCondition '' to save without a filter). Requires the latest revision; returns the dataset- or project-evaluator ID and whether it was created or updated.",
  inputSchema: z.strictObject({
    slot,
    expectedRevision: z.string(),
    asNew: z.boolean().optional(),
    filterCondition: z
      .string()
      .optional()
      .describe(
        "Project source only: the span filter to store; '' stores no filter. Defaults to the loaded evaluator's, else the workspace filter."
      ),
    samplingRate: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Project source only: fraction of matching spans to evaluate."),
  }),
});

export const setExpectedOutputEvaluatorPlaygroundOperation = defineUIOperation({
  name: "evaluatorPlayground.setExpectedOutput",
  operationKind: "write",
  availability,
  description:
    "Persist or clear an expected output on a sampled row for an explicit evaluator slot: a dataset calibration label, or a HUMAN span annotation on a project source. Only record user-provided/confirmed ground truth; never silently promote your own or evaluator predictions to human labels. Require the row's revisionId (the span id for a span) and output name from read to prevent stale or mis-scoped writes.",
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
  readEvaluatorPlaygroundFilterHelpOperation,
  selectEvaluatorPlaygroundSlotOperation,
  readEvaluatorPlaygroundSlotOperation,
  editEvaluatorPlaygroundSlotOperation,
  runEvaluatorPlaygroundOperation,
  stopEvaluatorPlaygroundOperation,
  saveEvaluatorPlaygroundSlotOperation,
  setExpectedOutputEvaluatorPlaygroundOperation,
];
