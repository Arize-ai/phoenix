/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 *
 * This module is an aggregator: each tool defines itself in its own module
 * under `@phoenix/agent/tools/*` using the `defineTool` helper, and this file
 * assembles them into the ordered registry and exposes the dispatch +
 * UI-behavior surface to the chat layer.
 *
 * Browser UI-state operations (time range, spans filter, playground prompts,
 * evaluator drafts, …) are no longer individual tools: they live in the
 * UI-operation catalog (`@phoenix/agent/uiOperations`) and execute through
 * the `search_ui` / `execute_ui` meta-tools registered below.
 */
import {
  createAnnotationConfigAgentTool,
  updateAnnotationConfigAgentTool,
} from "@phoenix/agent/tools/annotationConfig";
import { batchSpanAnnotateAgentTool } from "@phoenix/agent/tools/batchSpanAnnotate";
import { createDatasetAgentTool } from "@phoenix/agent/tools/createDataset";
import {
  deleteDatasetAgentTool,
  patchDatasetAgentTool,
} from "@phoenix/agent/tools/datasetEdit";
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
import { patchExperimentAgentTool } from "@phoenix/agent/tools/patchExperiment";
import { renderGenerativeUIAgentTool } from "@phoenix/agent/tools/renderGenerativeUI";
import { addSpansToDatasetAgentTool } from "@phoenix/agent/tools/spansToDataset";
import { executeUiAgentTool } from "@phoenix/agent/uiOperations/executeUiAgentTool";
import { searchUiAgentTool } from "@phoenix/agent/uiOperations/searchUiAgentTool";

import type { AgentToolDefinition } from "./registry/defineTool";
import { createAgentToolDispatcher } from "./registry/dispatch";

export type { AgentToolCall, AgentToolUIBehavior } from "./registry/defineTool";

/**
 * The two meta-tools fronting the UI-operation catalog: `search_ui`
 * discovers operations and their signatures; `execute_ui` runs an
 * agent-authored script against them in a sandboxed worker.
 */
const uiOperationTools: AgentToolDefinition[] = [
  searchUiAgentTool,
  executeUiAgentTool,
];

/**
 * Dataset management tools (built with the lower-level `defineTool`). They are
 * not UI operations: reads execute directly against the Relay environment, and
 * writes stage a pending-approval store entry (the inline Accept/Reject card)
 * — auto-applied in bypass edit mode. The dataset to act on is resolved from
 * the advertised UI context, never supplied by the model.
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
 * The remaining tools own what they do (built with the lower-level
 * `defineTool`):
 * - `get_route_info` resolves route info from the catalog and returns it directly;
 * - `render_generative_ui` synchronously acknowledges an out-of-band chart render;
 * - `ask_user`, `batch_span_annotate`, and `patch_experiment` write a
 *   pending-approval store entry and defer their output to a later accept/reject.
 */
const tools: AgentToolDefinition[] = [
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
  ...uiOperationTools,
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

/**
 * Whether a tool declared `rehydratable`, so an unresolved call can be
 * re-dispatched on session load. False for unregistered tools.
 */
export const isRehydratableAgentTool = dispatcher.isRehydratableAgentTool;
