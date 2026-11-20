import { z } from "zod";

import { editProjectEvaluatorAttachInputSchema } from "@phoenix/agent/tools/projectEvaluatorAttach/attach";
import {
  DEFAULT_BENCH_RUN_COUNT,
  MAX_BENCH_RUN_COUNT,
  runProjectEvaluatorBenchInputSchema,
} from "@phoenix/agent/tools/projectEvaluatorBench/bench";
import {
  readProjectEvaluatorGalleryInputSchema,
  openProjectEvaluatorGalleryItemInputSchema,
} from "@phoenix/agent/tools/projectEvaluatorGallery/gallery";
import { editProjectEvaluatorScopeInputSchema } from "@phoenix/agent/tools/projectEvaluatorScope/scope";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";

/**
 * Where the project evaluator form operations mount. The forms are routes,
 * so an agent reaches them with `navigation.goTo`.
 */
export const PROJECT_EVALUATOR_FORM_ROUTE_HINT =
  "an open project (online) evaluator form. To create one, navigate with " +
  "navigation.goTo to /projects/<projectId>/evaluators/new/llm, " +
  "/projects/<projectId>/evaluators/new/code, or " +
  "/projects/<projectId>/evaluators/new/decision; to edit a saved one, to " +
  "/projects/<projectId>/evaluators/<encodeURIComponent(projectEvaluatorId)>/edit";

const emptyInputSchema = z.strictObject({});

const scopeSnapshotSchema = z.object({
  targetType: z.enum(["SPAN", "TRACE", "SESSION"]),
  filterLanguage: z.enum(["span", "trace", "session"]),
  filterCondition: z.string(),
  samplingRate: z.number(),
  evaluationDelaySeconds: z.number().nullable(),
  tracingEnabled: z.boolean(),
  isTargetEditable: z.boolean(),
});

export const readProjectEvaluatorScopeOperation = defineUIOperation({
  name: "evaluators.project.scope.read",
  description:
    "Read the scope of the open project (online) evaluator form: which " +
    "records it evaluates (`targetType` SPAN, TRACE, or SESSION), the " +
    "`filterCondition` in that target's filter language, `samplingRate` " +
    "(0 to 1), `evaluationDelaySeconds` (null for spans), `tracingEnabled`, " +
    "and whether the target can still change. Works on the LLM, code, and " +
    "decision project forms; the definition itself is read with " +
    "evaluators.llm.read, evaluators.code.read, or evaluators.decision.read.",
  inputSchema: emptyInputSchema,
  outputSchema: scopeSnapshotSchema,
  operationKind: "read",
  defaultSuccessOutput: "Project evaluator scope read.",
  availability: { routeHint: PROJECT_EVALUATOR_FORM_ROUTE_HINT },
});

export const editProjectEvaluatorScopeOperation = defineUIOperation({
  name: "evaluators.project.scope.edit",
  description:
    "Change the scope of the open project (online) evaluator form, as the " +
    "Evaluator Scope fields would. Pass only the fields to change, e.g. " +
    '{"targetType":"SPAN","filterCondition":"span_kind == \'LLM\'","samplingRate":0.25} or ' +
    '{"targetType":"SESSION","filterCondition":"num_traces >= 2","evaluationDelaySeconds":120}. ' +
    "The filter is validated against the project before it is applied; an " +
    "invalid one is refused with the parser's message and nothing changes. " +
    "Changing the target swaps the filter language and resets the filter " +
    "unless one is given. Edit forms cannot change the target. Nothing is " +
    "saved until the form is submitted. The test bench reloads its records " +
    "after a target or filter change.",
  inputSchema: editProjectEvaluatorScopeInputSchema,
  outputSchema: z.object({
    status: z.literal("accepted"),
    scope: scopeSnapshotSchema,
  }),
  operationKind: "approval",
  requireSession: true,
  defaultSuccessOutput: "Project evaluator scope updated.",
  availability: { routeHint: PROJECT_EVALUATOR_FORM_ROUTE_HINT },
});

const benchAnnotationSchema = z.object({
  name: z.string(),
  label: z.string().nullable(),
  score: z.number().nullable(),
  explanation: z.string().nullable(),
});

export const readProjectEvaluatorBenchOperation = defineUIOperation({
  name: "evaluators.project.bench.read",
  description:
    "Read the test bench of the open project (online) evaluator form: the " +
    "most recent records that match the form's current scope (newest first, " +
    "one page), each with its `recordId`, a snippet, and what the last test " +
    "on it returned (`status`, annotations with label/score/explanation, " +
    "errors, and `isStale` when the draft changed since). `runBlocker` says " +
    "what stops every test, such as an invalid annotation config. Waits for " +
    "the bench to finish loading after a scope change.",
  inputSchema: emptyInputSchema,
  outputSchema: z.object({
    targetType: z.string(),
    recordKind: z.string(),
    timeWindow: z.string(),
    hasMore: z.boolean(),
    runBlocker: z.string().nullable(),
    records: z.array(
      z.object({
        recordId: z.string(),
        name: z.string(),
        snippet: z.string().nullable(),
        startTime: z.string().nullable(),
        status: z.string(),
        isStale: z.boolean(),
        annotations: z.array(benchAnnotationSchema),
        errors: z.array(z.string()),
        missingInputCount: z.number(),
        unavailableReason: z.string().nullable(),
      })
    ),
  }),
  operationKind: "read",
  defaultSuccessOutput: "Project evaluator test bench read.",
  availability: { routeHint: PROJECT_EVALUATOR_FORM_ROUTE_HINT },
});

export const runProjectEvaluatorBenchOperation = defineUIOperation({
  name: "evaluators.project.bench.run",
  description:
    "Test the open project (online) evaluator draft on real records from the " +
    "form's test bench — the same preview the bench's Test buttons run, so " +
    "the human sees the rows fill in — and return each record's verdict " +
    "(label, score, explanation) or error. Pass `recordIds` from " +
    "evaluators.project.bench.read, or `count` to test the most recent " +
    `runnable records (default ${DEFAULT_BENCH_RUN_COUNT}, at most ${MAX_BENCH_RUN_COUNT}). ` +
    "Runs the draft as it is in the form now, including unsaved edits; " +
    "results are not saved to the project. This is how to test a project " +
    "evaluator; evaluators.llm.test and evaluators.code.test are for " +
    "dataset forms.",
  inputSchema: runProjectEvaluatorBenchInputSchema,
  outputSchema: z.object({
    targetType: z.string(),
    tested: z.number(),
    failed: z.number(),
    results: z.array(
      z.object({
        recordId: z.string(),
        name: z.string(),
        status: z.enum(["annotated", "failed"]),
        annotations: z.array(benchAnnotationSchema),
        errors: z.array(z.string()),
      })
    ),
  }),
  operationKind: "write",
  longRunning: true,
  defaultSuccessOutput: "Project evaluator test bench run completed.",
  availability: { routeHint: PROJECT_EVALUATOR_FORM_ROUTE_HINT },
});

/**
 * Where the attach operations mount: the form that attaches an existing code
 * or decision evaluator to a project.
 */
const PROJECT_EVALUATOR_ATTACH_ROUTE_HINT =
  "an open attach form for an existing code or decision evaluator: navigate " +
  "with navigation.goTo to " +
  "/projects/<projectId>/evaluators/new/attach/<encodeURIComponent(evaluatorId)>";

const attachSnapshotSchema = z.object({
  evaluatorId: z.string(),
  name: z.string(),
  kind: z.enum(["CODE", "DECISION"]),
  variables: z.array(z.string()),
  requiredVariables: z.array(z.string()),
  inputDescriptions: z.record(z.string(), z.string()),
  inputMapping: z.object({
    pathMapping: z.record(z.string(), z.string()),
    literalMapping: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()])
    ),
  }),
  isDefaultMapping: z.boolean(),
});

export const readProjectEvaluatorAttachOperation = defineUIOperation({
  name: "evaluators.project.attach.read",
  description:
    "Read the open attach form: the existing evaluator it attaches " +
    "(`evaluatorId`, `name`, `kind` CODE or DECISION), the `variables` it " +
    "reads and which are `requiredVariables`, their `inputDescriptions`, and " +
    "the `inputMapping` the project will read them through " +
    "(`isDefaultMapping` while it is still the one the form opened with). " +
    "Attaching keeps the evaluator's definition, so evaluators.code.read and " +
    "evaluators.decision.read do not apply here. The scope is read with " +
    "evaluators.project.scope.read; test with evaluators.project.bench.run.",
  inputSchema: emptyInputSchema,
  outputSchema: attachSnapshotSchema,
  operationKind: "read",
  defaultSuccessOutput: "Attach form read.",
  availability: { routeHint: PROJECT_EVALUATOR_ATTACH_ROUTE_HINT },
});

export const editProjectEvaluatorAttachOperation = defineUIOperation({
  name: "evaluators.project.attach.edit",
  description:
    "Change the input mapping on the open attach form: which path on each " +
    "record (or which literal) feeds each of the evaluator's inputs, e.g. " +
    '{"inputMapping":{"pathMapping":{"output":"attributes.output.value"}}}. ' +
    "A half that is given replaces that half whole; the other half is kept. " +
    "Only the evaluator's own inputs can be mapped. Nothing is saved until " +
    "evaluators.project.attach.submit.",
  inputSchema: editProjectEvaluatorAttachInputSchema,
  outputSchema: z.object({
    status: z.literal("accepted"),
    attach: attachSnapshotSchema,
  }),
  operationKind: "approval",
  requireSession: true,
  defaultSuccessOutput: "Attach form mapping updated.",
  availability: { routeHint: PROJECT_EVALUATOR_ATTACH_ROUTE_HINT },
});

export const submitProjectEvaluatorAttachOperation = defineUIOperation({
  name: "evaluators.project.attach.submit",
  description:
    "Attach the evaluator to the project with the form's scope and mapping, " +
    "through the form's own Attach button. Resolves once the project " +
    "evaluator is saved, or with the error the form shows.",
  inputSchema: emptyInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Evaluator attached.",
  availability: { routeHint: PROJECT_EVALUATOR_ATTACH_ROUTE_HINT },
});

/**
 * Where the gallery operations mount: the project's evaluators page, which
 * the gallery modal and the creation forms open over.
 */
const PROJECT_EVALUATOR_GALLERY_ROUTE_HINT =
  "the project's Evaluators tab: navigate with navigation.goTo to " +
  "/projects/<projectId>/evaluators (the gallery and creation forms open over it)";

const galleryTemplateSchema = z.object({
  name: z.string(),
  kind: z.literal("LLM"),
  category: z.string(),
  description: z.string().nullable(),
  targetType: z.enum(["SPAN", "TRACE", "SESSION"]),
  filterCondition: z.string(),
  inputs: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      defaultPath: z.string().nullable(),
    })
  ),
  labels: z.array(z.object({ label: z.string(), score: z.number() })),
  optimizationDirection: z.string(),
});

export const readProjectEvaluatorGalleryOperation = defineUIOperation({
  name: "evaluators.project.gallery.read",
  description:
    "Read the project's evaluator gallery (Add evaluator > Browse eval " +
    "gallery), as its cards show it: the ready-made `templates` (each an LLM " +
    "judge with its category, description, the `targetType` and " +
    "`filterCondition` the form opens with, its `inputs` with any default " +
    "path, and its output `labels`), and the `customEvaluators` saved on " +
    "other projects that this one can reuse (LLM ones open as a copy, code " +
    "and decision ones as an attach). Pass `templateName` for one template's " +
    "details pane, which adds its details text and judge `promptMessages`. " +
    "Start from one with evaluators.project.gallery.open.",
  inputSchema: readProjectEvaluatorGalleryInputSchema,
  outputSchema: z.union([
    z.object({
      templates: z.array(galleryTemplateSchema),
      customEvaluators: z.array(
        z.object({
          evaluatorId: z.string(),
          name: z.string(),
          kind: z.enum(["LLM", "CODE", "DECISION"]),
          description: z.string().nullable(),
          opensAs: z.enum(["copy", "attach"]),
        })
      ),
    }),
    z.object({
      template: galleryTemplateSchema.extend({
        details: z.string().nullable(),
        promptMessages: z.array(
          z.object({ role: z.string(), content: z.string() })
        ),
      }),
    }),
  ]),
  operationKind: "read",
  defaultSuccessOutput: "Evaluator gallery read.",
  availability: { routeHint: PROJECT_EVALUATOR_GALLERY_ROUTE_HINT },
});

export const openProjectEvaluatorGalleryItemOperation = defineUIOperation({
  name: "evaluators.project.gallery.open",
  description:
    "Start a project evaluator from the gallery, as pressing its card does: " +
    "`templateName` opens the project LLM evaluator form prefilled from that " +
    "template (prompt, labels, target, filter, input mapping); a custom " +
    "evaluator's `evaluatorId` opens a copy (LLM) or the attach form (code, " +
    "decision). Nothing is saved: the form's own operations take over from " +
    "there (scope, edit, bench, submit), and the result names them. The " +
    "calling script must carry a write_description that mentions opening it.",
  inputSchema: openProjectEvaluatorGalleryItemInputSchema,
  outputSchema: z.object({
    status: z.literal("opened"),
    path: z.string(),
    next: z.string(),
  }),
  operationKind: "approval",
  requireSession: true,
  defaultSuccessOutput: "Gallery item opened.",
  availability: { routeHint: PROJECT_EVALUATOR_GALLERY_ROUTE_HINT },
});

export const projectEvaluatorOperations: UIOperationDescriptor[] = [
  readProjectEvaluatorScopeOperation,
  editProjectEvaluatorScopeOperation,
  readProjectEvaluatorBenchOperation,
  runProjectEvaluatorBenchOperation,
  readProjectEvaluatorAttachOperation,
  editProjectEvaluatorAttachOperation,
  submitProjectEvaluatorAttachOperation,
  readProjectEvaluatorGalleryOperation,
  openProjectEvaluatorGalleryItemOperation,
];
