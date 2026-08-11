import { setAppendedMessagesPathInputSchema } from "@phoenix/agent/tools/playgroundAppendedMessagesPath/schemas";
import { setPlaygroundExperimentRecordingInputSchema } from "@phoenix/agent/tools/playgroundExperimentRecording/schemas";
import { setPlaygroundRepetitionsInputSchema } from "@phoenix/agent/tools/playgroundRepetitions/schemas";
import { setTemplateVariablesPathInputSchema } from "@phoenix/agent/tools/playgroundTemplateVariablesPath/schemas";
import { setVariableValuesInputSchema } from "@phoenix/agent/tools/playgroundVariableValues/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/** Route hint shared by every playground operation. */
const PLAYGROUND_ROUTE_HINT =
  "the Prompt Playground page (a /playground route)";

/**
 * The catalog entry replacing the `set_variable_values` client-action tool.
 * The input schema is reused from the existing tool module; the description
 * moves here verbatim from the Python `DESCRIPTION`.
 */
export const setVariableValuesOperation = defineUiOperation({
  name: "playground.variables.set",
  description:
    "Set manual input values for template variables in the currently mounted " +
    "playground. Use this when the user asks to fill, provide, change, or set " +
    "playground variables before running or comparing prompts. This only updates " +
    "variable values in browser UI state; it does not edit prompt messages, change " +
    "dataset mappings, or run the playground.",
  inputSchema: setVariableValuesInputSchema,
  kind: "write",
  defaultSuccessOutput: "Variable values updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `set_template_variables_path`
 * client-action tool.
 */
export const setTemplateVariablesPathOperation = defineUiOperation({
  name: "playground.variables.setPath",
  description:
    "Set the dataset field path that playground template variables resolve against, " +
    "when a prompt references dataset fields outside the default `input` root. This " +
    "only updates browser UI state; it does not edit prompt messages or run the playground.",
  inputSchema: setTemplateVariablesPathInputSchema,
  kind: "write",
  defaultSuccessOutput: "Template variables path updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `set_appended_messages_path` client-action
 * tool.
 */
export const setAppendedMessagesPathOperation = defineUiOperation({
  name: "playground.messages.setPath",
  description:
    "Set the dataset message-list path appended to playground runs for the currently " +
    "mounted playground. Use this when the user asks to append, set, or clear the " +
    "conversational message history for message-based dataset re-runs. This only updates " +
    "browser UI state; it does not edit prompt messages or run the playground.",
  inputSchema: setAppendedMessagesPathInputSchema,
  kind: "write",
  defaultSuccessOutput: "Appended messages path updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `set_playground_experiment_recording`
 * client-action tool.
 */
export const setPlaygroundExperimentRecordingOperation = defineUiOperation({
  name: "playground.experiment.setRecording",
  description:
    "Set whether future dataset-backed playground runs in the currently mounted " +
    "playground are recorded as persistent experiments or created as temporary " +
    "unrecorded runs, and optionally stage a name, description, and metadata for the " +
    "experiments the next run produces. Use this before running when the user asks to " +
    "record, persist, save the run as an experiment, run without recording, or label " +
    "the next experiment with notes such as a hypothesis.",
  inputSchema: setPlaygroundExperimentRecordingInputSchema,
  kind: "write",
  defaultSuccessOutput: "Experiment recording settings updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `set_playground_repetitions` client-action
 * tool.
 */
export const setPlaygroundRepetitionsOperation = defineUiOperation({
  name: "playground.repetitions.set",
  description:
    "Set the playground-wide repetitions count in the currently mounted playground. " +
    "Use this before running when the user wants more confidence across repeated " +
    "LLM calls, is investigating flaky outputs, or wants to validate structured " +
    "output or tool-call behavior before saving a prompt.",
  inputSchema: setPlaygroundRepetitionsInputSchema,
  kind: "write",
  defaultSuccessOutput: "Playground repetitions updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground settings operations, for catalog assembly. */
export const playgroundSettingsOperations: UiOperationDescriptor[] = [
  setVariableValuesOperation,
  setTemplateVariablesPathOperation,
  setAppendedMessagesPathOperation,
  setPlaygroundExperimentRecordingOperation,
  setPlaygroundRepetitionsOperation,
];
