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
  editCodeEvaluatorDraftAgentTool,
  openCodeEvaluatorFormAgentTool,
  readCodeEvaluatorDraftAgentTool,
  submitCodeEvaluatorDraftAgentTool,
  testCodeEvaluatorDraftAgentTool,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { readDatasetEvaluatorDefinitionAgentTool } from "@phoenix/agent/tools/datasetEvaluatorDefinition";
import { openDatasetEvaluatorForEditAgentTool } from "@phoenix/agent/tools/datasetEvaluatorForEdit";
import { setDatasetEvaluatorSelectionAgentTool } from "@phoenix/agent/tools/datasetEvaluatorSelection";
import { askUserAgentTool } from "@phoenix/agent/tools/elicit";
import { getRouteInfoAgentTool } from "@phoenix/agent/tools/getRouteInfo";
import {
  editLlmEvaluatorDraftAgentTool,
  openLlmEvaluatorFormAgentTool,
  readLlmEvaluatorDraftAgentTool,
  submitLlmEvaluatorDraftAgentTool,
  testLlmEvaluatorDraftAgentTool,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
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
 * The remaining tools are not built on the client-action helper — they delegate
 * to no `registeredClientActions` entry and own what they do (built with the
 * lower-level `defineTool`):
 * - `get_route_info` resolves route info from the catalog and returns it directly;
 * - `render_generative_ui` synchronously acknowledges an out-of-band chart render;
 * - `ask_user` writes a pending-approval store entry and defers its output to a
 *   later response.
 *
 * Requiring an active session is orthogonal to this split: the session-gated
 * tool here (`ask_user`) composes the
 * same `requireToolSession` guard that `defineClientActionTool` uses for its
 * `requireSession` knob, so the guard lives in one place rather than per tool.
 */
const tools: AgentToolDefinition[] = [
  getRouteInfoAgentTool,
  renderGenerativeUIAgentTool,
  askUserAgentTool,
];

/** Ordered registry of all frontend-executable tools. */
const agentToolDefinitions: AgentToolDefinition[] = [
  ...clientActionTools,
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

/**
 * Whether a tool declared `rehydratable`, so an unresolved call can be
 * re-dispatched on session load. False for unregistered tools.
 */
export const isRehydratableAgentTool = dispatcher.isRehydratableAgentTool;
