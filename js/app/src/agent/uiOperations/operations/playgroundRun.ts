import { readExperimentResultsInputSchema } from "@phoenix/agent/tools/experimentResults/schemas";
import { readPlaygroundOutputInputSchema } from "@phoenix/agent/tools/playgroundOutput/schemas";
import {
  cancelPlaygroundRunInputSchema,
  runPlaygroundInputSchema,
} from "@phoenix/agent/tools/playgroundRun/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/** Route hint shared by every playground operation. */
const PLAYGROUND_ROUTE_HINT =
  "the Prompt Playground page (a /playground route)";

/**
 * The catalog entry replacing the `run_playground` client-action tool. The
 * input schema is reused from the existing tool module; the description moves
 * here verbatim from the Python `DESCRIPTION`.
 */
export const runPlaygroundOperation = defineUiOperation({
  name: "playground.run",
  description:
    "Run the currently mounted playground using the browser UI state. This starts " +
    "the same run the user would start with the playground Run button, so it uses " +
    "the current prompt instances, model settings, inputs, dataset selection, tools, " +
    "and streaming preferences visible in the UI. It runs all current comparison " +
    "instances together, and resolves only when the whole run ends (every instance " +
    "finished, or the user stopped it) — await it, then read the results in the " +
    "same script: `playground.experiment.readResults` for the scored per-example " +
    "results when the run recorded experiments (its output includes the " +
    "`experimentIds`), or `playground.run.readOutput` for the raw instance output " +
    "otherwise.",
  inputSchema: runPlaygroundInputSchema,
  kind: "write",
  longRunning: true,
  defaultSuccessOutput: "Playground run finished.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `cancel_playground_run` client-action tool.
 */
export const cancelPlaygroundRunOperation = defineUiOperation({
  name: "playground.run.cancel",
  description:
    "Cancel the currently active run in the mounted playground. This stops the " +
    "same run the user would stop with the playground Stop button and clears the " +
    "active run state for all currently visible comparison instances.",
  inputSchema: cancelPlaygroundRunInputSchema,
  kind: "write",
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
export const readPlaygroundOutputOperation = defineUiOperation({
  name: "playground.run.readOutput",
  description:
    "Read the output from the currently mounted playground's latest run. The result " +
    "includes each matching instance's raw output, run status, errors, tool calls, " +
    "and traceId when the run produced a Phoenix trace. Use this after `playground.run` " +
    "finishes so you can inspect the model response and analyze the trace.",
  inputSchema: readPlaygroundOutputInputSchema,
  kind: "read",
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
export const readExperimentResultsOperation = defineUiOperation({
  name: "playground.experiment.readResults",
  description:
    "Read the scored results of a recorded experiment. Pass one of the " +
    "`experimentIds` returned by `playground.run`. Returns the experiment's " +
    "status and metrics (run counts, error rate, latency, cost), per-evaluator " +
    "annotation summaries (mean score, count, errors), and every run with its " +
    "dataset example (input, reference output, metadata), actual output, error, " +
    "and annotation labels/scores/explanations. The aggregate metrics and " +
    "summaries are always included regardless of `failuresOnly`, which only " +
    "trims the runs list to those that errored or scored below 1 — so call it " +
    "ONCE per experiment: `failuresOnly: true` while iterating (the summaries " +
    "already cover the passing runs), the full read only when you need passing " +
    "outputs too. Never call it twice for the same experiment. Call it in the " +
    "same script as `playground.run`, right after the run resolves.",
  inputSchema: readExperimentResultsInputSchema,
  kind: "read",
  defaultSuccessOutput: "Experiment results read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground run operations, for catalog assembly. */
export const playgroundRunOperations: UiOperationDescriptor[] = [
  runPlaygroundOperation,
  cancelPlaygroundRunOperation,
  readPlaygroundOutputOperation,
  readExperimentResultsOperation,
];
