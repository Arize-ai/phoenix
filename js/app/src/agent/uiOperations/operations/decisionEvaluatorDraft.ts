import { z } from "zod";

import { editDecisionEvaluatorDraftInputSchema } from "@phoenix/agent/tools/decisionEvaluatorDraft/draft";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";

const DECISION_EVALUATOR_DRAFT_ROUTE_HINT =
  "an open project (online) decision-evaluator form: navigate with " +
  "navigation.goTo to /projects/<projectId>/evaluators/new/decision, or to " +
  "/projects/<projectId>/evaluators/<encodeURIComponent(projectEvaluatorId)>/edit " +
  "for a saved decision evaluator";

const emptyInputSchema = z.strictObject({});

export const readDecisionEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.decision.read",
  description:
    "Read the open project decision-evaluator draft: `name`, the decision " +
    "`model`, the `availableModels` the form's model menu offers (each with a " +
    "ready-made `target` for set_model; null when the catalog cannot load), " +
    "`templateFormat`, the `state` template (the evidence the model reads), " +
    "the `questions` (predicate yes/no, choice, or scale), the " +
    "`scoringPolicy` that turns answers into labels and scores, the " +
    "`variables` the templates read, `inputMapping`, and `definitionErrors` " +
    "that would stop a test or save. The scope is read with " +
    "evaluators.project.scope.read and tests run with " +
    "evaluators.project.bench.run.",
  inputSchema: emptyInputSchema,
  operationKind: "read",
  defaultSuccessOutput: "Decision evaluator draft read.",
  availability: { routeHint: DECISION_EVALUATOR_DRAFT_ROUTE_HINT },
});

export const editDecisionEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.decision.edit",
  description:
    "Edit the open project decision-evaluator draft. Read it first with " +
    "evaluators.decision.read. Operations: " +
    '{"type":"set_name","name":"resolved"}; ' +
    '{"type":"set_state","template":"Request:\\n{{input}}\\n\\nResponse:\\n{{output}}"}; ' +
    '{"type":"set_questions","questions":[{"name":"resolved","type":"predicate",' +
    '"instructions":"Does the response resolve the request?"}]}; ' +
    '{"type":"set_scoring_policy","scoringPolicy":{"questions":[{"predicate":' +
    '{"name":"resolved","threshold":0.5,"optimizationDirection":"MAXIMIZE"}}]}}; ' +
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{"input":"input"}}}; ' +
    '{"type":"set_model","target":{"type":"builtin","provider":"TYPESAFE","modelName":"jev-1.14.0"}}, ' +
    "with the target taken verbatim from `availableModels`. " +
    "Questions are replaced as a whole list; a question that keeps its name " +
    "keeps its place in the editor. An edit that leaves the decision invalid " +
    "is refused whole with the reasons. On an edit form, definition changes " +
    "save as a new version of the shared decision.",
  inputSchema: editDecisionEvaluatorDraftInputSchema,
  operationKind: "approval",
  requireSession: true,
  defaultSuccessOutput: "Decision evaluator draft edits applied.",
  availability: { routeHint: DECISION_EVALUATOR_DRAFT_ROUTE_HINT },
});

export const submitDecisionEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.decision.submit",
  description:
    "Save the open project decision-evaluator draft, with its scope, " +
    "through the form's own Create/Update path. Terminal save only; it does " +
    "not modify the draft.",
  inputSchema: emptyInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Decision evaluator saved.",
  availability: { routeHint: DECISION_EVALUATOR_DRAFT_ROUTE_HINT },
});

export const decisionEvaluatorDraftOperations: UIOperationDescriptor[] = [
  readDecisionEvaluatorDraftOperation,
  editDecisionEvaluatorDraftOperation,
  submitDecisionEvaluatorDraftOperation,
];
