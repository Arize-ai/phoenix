import { z } from "zod";

import { readExperimentResultsInputSchema } from "@phoenix/agent/tools/experimentResults/schemas";
import { readPlaygroundOutputInputSchema } from "@phoenix/agent/tools/playgroundOutput/schemas";
import {
  cancelPlaygroundRunInputSchema,
  runPlaygroundInputSchema,
} from "@phoenix/agent/tools/playgroundRun/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";
import { PLAYGROUND_ROUTE_HINT } from "./playgroundRouteHints";

/**
 * The catalog entry replacing the `run_playground` client-action tool. The
 * input schema is reused from the existing tool module.
 */
export const runPlaygroundOperation = defineUIOperation({
  name: "playground.run",
  description:
    "Run every task in the currently mounted playground: the same run the user " +
    "would start with the Run button. Prompt tasks run with the current prompts, " +
    "model settings, inputs or dataset selection, tools and streaming preferences " +
    "visible in the UI. Evaluator tasks run as experiments over the selected " +
    "dataset (and splits), one experiment per task, judging each example and " +
    "writing an annotation named after the task's `annotationName`; they need a " +
    "dataset and a configuration without `validationError` (see " +
    "`playground.evaluator.read`), and the run is rejected up front otherwise. " +
    "Runs are recorded experiments when recording is on " +
    "(`playground.experiment.setRecording`) and temporary ones otherwise, for both " +
    "kinds. It runs all comparison instances together and resolves only when the " +
    "whole run ends (every instance finished, or the user stopped it) — await it, " +
    "then read the results in the same script: `playground.experiment.readResults` " +
    "with one of the returned `experimentIds` (in instance order) for the scored " +
    "per-example results when the run produced experiments, or " +
    "`playground.run.readOutput` for the raw prompt output otherwise.",
  inputSchema: runPlaygroundInputSchema,
  operationKind: "write",
  longRunning: true,
  defaultSuccessOutput: "Playground run finished.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `cancel_playground_run` client-action tool.
 */
export const cancelPlaygroundRunOperation = defineUIOperation({
  name: "playground.run.cancel",
  description:
    "Cancel the currently active run in the mounted playground. This stops the " +
    "same run the user would stop with the playground Stop button and clears the " +
    "active run state for all currently visible comparison instances.",
  inputSchema: cancelPlaygroundRunInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Playground run canceled.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `read_playground_output` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`
 * with tool names updated to operation names.
 */
export const readPlaygroundOutputOperation = defineUIOperation({
  name: "playground.run.readOutput",
  description:
    "Read the output from the currently mounted playground's latest run. The result " +
    "includes each matching instance's raw output, run status, errors, tool calls, " +
    "and traceId when the run produced a Phoenix trace. Use this after `playground.run` " +
    "finishes so you can inspect the model response and analyze the trace.",
  inputSchema: readPlaygroundOutputInputSchema,
  // Documentation-only: `instances` carries per-instance repetition
  // snapshots (output text, traceId once finished); kept approximate here.
  outputSchema: z.object({
    status: z.enum(["not_started", "running", "partial", "finished"]),
    instances: z.array(z.unknown()),
    message: z.string(),
  }),
  operationKind: "read",
  defaultSuccessOutput: "Playground output read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry closing the experiment-iteration loop: after a recorded
 * `playground.run`, this reads the scored per-example results the model needs
 * to decide its next prompt candidate — without hand-writing GraphQL.
 */
export const readExperimentResultsOperation = defineUIOperation({
  name: "playground.experiment.readResults",
  description:
    "Read the scored results of an experiment. Pass one of the `experimentIds` " +
    "returned by `playground.run`. Returns the experiment's status, `taskKind` " +
    "(`prompt` or `evaluator`) and metrics " +
    "(run counts, error rate, latency, cost), per-evaluator annotation summaries " +
    "(mean score, count, errors), and every run with its dataset example (input, " +
    "reference output, metadata, the example's current `revisionId`, and its " +
    "`expectedOutputs` by `annotationName`, which are authoritative over the same " +
    "records in `metadata`), actual output, error, and annotation " +
    "labels/scores/explanations. For an evaluator task's experiment the " +
    "evaluator's verdict is both the run's `output` and an annotation named after " +
    "the task's `annotationName`; compare it with `expectedOutputs`, and record " +
    "ground truth the user confirms with `playground.expectedOutput.set` using the " +
    "run's `exampleId` and `revisionId`. The aggregate metrics and summaries are " +
    "always included regardless of `failuresOnly`, which only trims the runs list " +
    "to those that errored or scored below 1 — so call it ONCE per experiment: " +
    "`failuresOnly: true` while iterating (the summaries already cover the passing " +
    "runs), the full read only when you need passing outputs too. Never call it " +
    "twice for the same experiment. Call it in the same script as " +
    "`playground.run`, right after the run resolves.",
  inputSchema: readExperimentResultsInputSchema,
  operationKind: "read",
  defaultSuccessOutput: "Experiment results read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground run operations, for catalog assembly. */
export const playgroundRunOperations: UIOperationDescriptor[] = [
  runPlaygroundOperation,
  cancelPlaygroundRunOperation,
  readPlaygroundOutputOperation,
  readExperimentResultsOperation,
];
