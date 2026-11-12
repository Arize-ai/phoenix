import { z } from "zod";

import {
  DEFAULT_BENCH_RUN_COUNT,
  MAX_BENCH_RUN_COUNT,
  runProjectEvaluatorBenchInputSchema,
} from "@phoenix/agent/tools/projectEvaluatorBench/bench";
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

export const projectEvaluatorOperations: UIOperationDescriptor[] = [
  readProjectEvaluatorScopeOperation,
  editProjectEvaluatorScopeOperation,
  readProjectEvaluatorBenchOperation,
  runProjectEvaluatorBenchOperation,
];
