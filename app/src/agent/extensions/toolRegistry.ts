/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 *
 * This module is an aggregator: each tool defines itself in its own module
 * under `@phoenix/agent/tools/*` using the `defineTool` / `defineClientActionTool`
 * helpers, and this file assembles them into the ordered registry and exposes
 * the dispatch + UI-behavior surface to the chat layer.
 *
 * To add, edit, or remove a tool, define it in its own module with the helpers
 * in `./registry/defineTool` or `./registry/defineClientActionTool`, then list
 * it in the appropriate array below.
 */
import {
  createAnnotationConfigAgentTool,
  updateAnnotationConfigAgentTool,
} from "@phoenix/agent/tools/annotationConfig";
import { bashAgentTool } from "@phoenix/agent/tools/bash";
import { batchSpanAnnotateAgentTool } from "@phoenix/agent/tools/batchSpanAnnotate";
import {
  editCodeEvaluatorDraftAgentTool,
  openCodeEvaluatorFormAgentTool,
  readCodeEvaluatorDraftAgentTool,
  submitCodeEvaluatorDraftAgentTool,
  testCodeEvaluatorDraftAgentTool,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { createDatasetAgentTool } from "@phoenix/agent/tools/createDataset";
import {
  deleteDatasetAgentTool,
  patchDatasetAgentTool,
} from "@phoenix/agent/tools/datasetEdit";
import { readDatasetEvaluatorDefinitionAgentTool } from "@phoenix/agent/tools/datasetEvaluatorDefinition";
import { openDatasetEvaluatorForEditAgentTool } from "@phoenix/agent/tools/datasetEvaluatorForEdit";
import { setDatasetEvaluatorSelectionAgentTool } from "@phoenix/agent/tools/datasetEvaluatorSelection";
import {
  addDatasetExamplesAgentTool,
  deleteDatasetExamplesAgentTool,
  listDatasetExamplesAgentTool,
  patchDatasetExamplesAgentTool,
} from "@phoenix/agent/tools/datasetExamples";
import {
  createDatasetLabelAgentTool,
  deleteDatasetLabelsAgentTool,
  listDatasetLabelsAgentTool,
  listLabelsAgentTool,
  setDatasetLabelsAgentTool,
} from "@phoenix/agent/tools/datasetLabels";
import {
  createDatasetSplitAgentTool,
  deleteDatasetSplitsAgentTool,
  listDatasetSplitsAgentTool,
  listSplitsAgentTool,
  patchDatasetSplitAgentTool,
  setDatasetExampleSplitsAgentTool,
} from "@phoenix/agent/tools/datasetSplits";
import { askUserAgentTool } from "@phoenix/agent/tools/elicit";
import { getRouteInfoAgentTool } from "@phoenix/agent/tools/getRouteInfo";
import { listDatasetsAgentTool } from "@phoenix/agent/tools/listDatasets";
import {
  editLlmEvaluatorDraftAgentTool,
  openLlmEvaluatorFormAgentTool,
  readLlmEvaluatorDraftAgentTool,
  submitLlmEvaluatorDraftAgentTool,
  testLlmEvaluatorDraftAgentTool,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import { patchExperimentAgentTool } from "@phoenix/agent/tools/patchExperiment";
import { setAppendedMessagesPathAgentTool } from "@phoenix/agent/tools/playgroundAppendedMessagesPath";
import { setPlaygroundExperimentRecordingAgentTool } from "@phoenix/agent/tools/playgroundExperimentRecording";
import { loadDatasetAgentTool } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  listPlaygroundModelTargetsAgentTool,
  setPlaygroundModelAgentTool,
} from "@phoenix/agent/tools/playgroundModel";
import { readPlaygroundOutputAgentTool } from "@phoenix/agent/tools/playgroundOutput";
import {
  addPromptInstanceAgentTool,
  clonePromptInstanceAgentTool,
  editPromptAgentTool,
  readPromptAgentTool,
  removePromptInstanceAgentTool,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  readPromptToolsAgentTool,
  writePromptToolsAgentTool,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { setPlaygroundRepetitionsAgentTool } from "@phoenix/agent/tools/playgroundRepetitions";
import {
  cancelPlaygroundRunAgentTool,
  runPlaygroundAgentTool,
} from "@phoenix/agent/tools/playgroundRun";
import { savePromptAgentTool } from "@phoenix/agent/tools/playgroundSavePrompt";
import { setTemplateVariablesPathAgentTool } from "@phoenix/agent/tools/playgroundTemplateVariablesPath";
import { setVariableValuesAgentTool } from "@phoenix/agent/tools/playgroundVariableValues";
import { renderGenerativeUIAgentTool } from "@phoenix/agent/tools/renderGenerativeUI";
import { setSpansFilterAgentTool } from "@phoenix/agent/tools/spansFilter";
import { addSpansToDatasetAgentTool } from "@phoenix/agent/tools/spansToDataset";
import { setTimeRangeAgentTool } from "@phoenix/agent/tools/timeRange";

import type { AgentToolDefinition } from "./registry/defineTool";
import { createAgentToolDispatcher } from "./registry/dispatch";

export type { AgentToolCall, AgentToolUIBehavior } from "./registry/defineTool";

/**
 * Client-action tools delegate to a client action that a mounted React component
 * registers in `registeredClientActions` (built with `defineClientActionTool`).
 * Each only works while its UI surface is mounted; off that surface it returns
 * a "not mounted" error. Registration order is cosmetic — dispatch is by name.
 */
const clientActionTools: AgentToolDefinition[] = [
  setTimeRangeAgentTool,
  setSpansFilterAgentTool,
  readPromptAgentTool,
  clonePromptInstanceAgentTool,
  addPromptInstanceAgentTool,
  removePromptInstanceAgentTool,
  editPromptAgentTool,
  savePromptAgentTool,
  readPromptToolsAgentTool,
  writePromptToolsAgentTool,
  setPlaygroundModelAgentTool,
  listPlaygroundModelTargetsAgentTool,
  loadDatasetAgentTool,
  runPlaygroundAgentTool,
  cancelPlaygroundRunAgentTool,
  readPlaygroundOutputAgentTool,
  setVariableValuesAgentTool,
  setPlaygroundExperimentRecordingAgentTool,
  setPlaygroundRepetitionsAgentTool,
  setTemplateVariablesPathAgentTool,
  setAppendedMessagesPathAgentTool,
  setDatasetEvaluatorSelectionAgentTool,
  openDatasetEvaluatorForEditAgentTool,
  readDatasetEvaluatorDefinitionAgentTool,
  openCodeEvaluatorFormAgentTool,
  readCodeEvaluatorDraftAgentTool,
  editCodeEvaluatorDraftAgentTool,
  testCodeEvaluatorDraftAgentTool,
  submitCodeEvaluatorDraftAgentTool,
  openLlmEvaluatorFormAgentTool,
  readLlmEvaluatorDraftAgentTool,
  editLlmEvaluatorDraftAgentTool,
  testLlmEvaluatorDraftAgentTool,
  submitLlmEvaluatorDraftAgentTool,
];

/**
 * Dataset management tools (built with the lower-level `defineTool`). They are
 * not client-action tools: reads execute directly against the Relay
 * environment, and writes stage a pending-approval store entry (the inline
 * Accept/Reject card) — auto-applied in bypass edit mode. The dataset to act on
 * is resolved from the advertised UI context, never supplied by the model.
 */
const datasetTools: AgentToolDefinition[] = [
  listDatasetsAgentTool,
  createDatasetAgentTool,
  patchDatasetAgentTool,
  deleteDatasetAgentTool,
  listDatasetExamplesAgentTool,
  addDatasetExamplesAgentTool,
  patchDatasetExamplesAgentTool,
  deleteDatasetExamplesAgentTool,
  listDatasetSplitsAgentTool,
  listSplitsAgentTool,
  createDatasetSplitAgentTool,
  setDatasetExampleSplitsAgentTool,
  patchDatasetSplitAgentTool,
  deleteDatasetSplitsAgentTool,
  listDatasetLabelsAgentTool,
  listLabelsAgentTool,
  createDatasetLabelAgentTool,
  setDatasetLabelsAgentTool,
  deleteDatasetLabelsAgentTool,
  addSpansToDatasetAgentTool,
];

/**
 * The remaining tools are not built on the client-action helper — they delegate
 * to no `registeredClientActions` entry and own what they do (built with the
 * lower-level `defineTool`):
 * - `bash` executes in the browser sandbox runtime;
 * - `get_route_info` resolves route info from the catalog and returns it directly;
 * - `render_generative_ui` synchronously acknowledges an out-of-band chart render;
 * - `ask_user`, `batch_span_annotate`, and `patch_experiment` write a
 *   pending-approval store entry and defer their output to a later accept/reject.
 *
 * Requiring an active session is orthogonal to this split: the session-gated
 * tools here (`ask_user`, `batch_span_annotate`, `patch_experiment`) compose the
 * same `requireToolSession` guard that `defineClientActionTool` uses for its
 * `requireSession` knob, so the guard lives in one place rather than per tool.
 */
const tools: AgentToolDefinition[] = [
  bashAgentTool,
  getRouteInfoAgentTool,
  renderGenerativeUIAgentTool,
  askUserAgentTool,
  batchSpanAnnotateAgentTool,
  patchExperimentAgentTool,
  createAnnotationConfigAgentTool,
  updateAnnotationConfigAgentTool,
];

/** Ordered registry of all frontend-executable tools. */
const agentToolDefinitions: AgentToolDefinition[] = [
  ...clientActionTools,
  ...datasetTools,
  ...tools,
];

const dispatcher = createAgentToolDispatcher(agentToolDefinitions);

/**
 * Validates and dispatches one tool call from the AI SDK runtime to the
 * matching frontend tool implementation.
 */
export const handleRegisteredAgentToolCall =
  dispatcher.handleRegisteredAgentToolCall;

/** Returns the UI surfacing hints declared by a tool, if any. */
export const getAgentToolUIBehavior = dispatcher.getAgentToolUIBehavior;
