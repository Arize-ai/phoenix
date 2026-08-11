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
    "finished, or the user stopped it) — await it, then read the results with " +
    "`playground.run.readOutput` in the same script.",
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

/** All playground run operations, for catalog assembly. */
export const playgroundRunOperations: UiOperationDescriptor[] = [
  runPlaygroundOperation,
  cancelPlaygroundRunOperation,
  readPlaygroundOutputOperation,
];
