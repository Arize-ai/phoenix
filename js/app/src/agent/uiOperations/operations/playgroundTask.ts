import { z } from "zod";

import {
  selectTaskInputSchema,
  taskSourceSchema,
} from "@phoenix/agent/tools/playgroundTask/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";
import { evaluatorTaskReadOutputSchema } from "./playgroundEvaluator";
import { promptSnapshotOutputSchema } from "./playgroundPrompt";
import { PLAYGROUND_ROUTE_HINT } from "./playgroundRouteHints";

export { taskSourceSchema };

/**
 * The catalog entry for the task menu: what an instance is. It replaces the
 * prompt picker action and the evaluator playground's slot selection with
 * one instance-addressed operation.
 */
export const selectTaskOperation = defineUIOperation({
  name: "playground.task.select",
  description:
    "Make one playground instance a task: what picking an item in the instance's " +
    'task menu does. `source` is {type:"new",kind:"prompt"|"LLM"|"CODE"} for a ' +
    'fresh draft, {type:"prompt",promptId,promptVersionId?,tagName?} for a saved ' +
    'prompt, {type:"evaluator",evaluatorId} for a saved LLM or code evaluator ' +
    "(built-in evaluators cannot be loaded), or " +
    '{type:"datasetEvaluator",datasetEvaluatorId} for an evaluator bound to a ' +
    "dataset. A prompt task given another prompt loads it in place, as the prompt " +
    "menu always has; anything else replaces the instance with a fresh one (the " +
    "result carries the new `instanceId`) and needs `discardChanges: true` when the " +
    "instance has unsaved changes. The page holds one kind of task: with more than " +
    "one instance the kind is fixed and a source of the other kind is rejected " +
    "(remove the other instances first); with one instance any source is allowed " +
    "and may change the page's kind. Rejected while a run is active. Awaits the " +
    "load (up to 15 s) and returns the instance's snapshot: the " +
    "`playground.prompt.read` shape for a prompt task, the " +
    "`playground.evaluator.read` shape for an evaluator task. A source that cannot " +
    "be loaded (deleted, built-in) fails with code NOT_FOUND. Instance ids are " +
    "numeric; letters A–D are only for talking to the user. Examples: " +
    '{source:{type:"evaluator",evaluatorId:"Q29kZUV2YWx1YXRvcjox"}}; ' +
    '{instanceId:2,source:{type:"new",kind:"CODE"},discardChanges:true}; ' +
    '{source:{type:"prompt",promptId:"UHJvbXB0OjE=",promptVersionId:null}}.',
  inputSchema: selectTaskInputSchema,
  // Documentation-only: the snapshot of the kind the instance now holds.
  outputSchema: z.union([
    promptSnapshotOutputSchema,
    evaluatorTaskReadOutputSchema,
  ]),
  operationKind: "write",
  // Awaits the fetch of a saved prompt or evaluator.
  longRunning: true,
  defaultSuccessOutput: "Task selected.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground task operations, for catalog assembly. */
export const playgroundTaskOperations: UIOperationDescriptor[] = [
  selectTaskOperation,
];
