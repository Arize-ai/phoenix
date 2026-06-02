import { bashAgentTool } from "@phoenix/agent/tools/bash";
/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 *
 * This module is an aggregator: each tool defines itself in its own module
 * under `@phoenix/agent/tools/*` using the `defineTool` / `defineClientActionTool`
 * helpers, and this file assembles them into the ordered registry and exposes
 * the dispatch + UI-behavior surface to the chat layer.
 *
 * To add, edit, or remove a tool, see
 * `.agents/skills/phoenix-pxi/resources/extending-tool-registry.md`.
 */
import { batchSpanAnnotateAgentTool } from "@phoenix/agent/tools/batchSpanAnnotate";
import {
  editCodeEvaluatorDraftAgentTool,
  openCodeEvaluatorFormAgentTool,
  readCodeEvaluatorDraftAgentTool,
  testCodeEvaluatorDraftAgentTool,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { askUserAgentTool } from "@phoenix/agent/tools/elicit";
import { readPlaygroundOutputAgentTool } from "@phoenix/agent/tools/playgroundOutput";
import {
  clonePromptInstanceAgentTool,
  editPromptAgentTool,
  readPromptAgentTool,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  readPromptToolsAgentTool,
  writePromptToolsAgentTool,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { runPlaygroundAgentTool } from "@phoenix/agent/tools/playgroundRun";
import { savePromptAgentTool } from "@phoenix/agent/tools/playgroundSavePrompt";
import { setVariableValuesAgentTool } from "@phoenix/agent/tools/playgroundVariableValues";
import { renderGenerativeUIAgentTool } from "@phoenix/agent/tools/renderGenerativeUI";
import { setSpansFilterAgentTool } from "@phoenix/agent/tools/spansFilter";
import { setTimeRangeAgentTool } from "@phoenix/agent/tools/timeRange";

import type { AgentToolDefinition } from "./registry/defineTool";
import { createAgentToolDispatcher } from "./registry/dispatch";

export type { AgentToolCall, AgentToolUIBehavior } from "./registry/defineTool";

/** Ordered registry of all frontend-executable tools. */
const agentToolDefinitions: AgentToolDefinition[] = [
  bashAgentTool,
  askUserAgentTool,
  setTimeRangeAgentTool,
  renderGenerativeUIAgentTool,
  setSpansFilterAgentTool,
  readPromptAgentTool,
  clonePromptInstanceAgentTool,
  editPromptAgentTool,
  savePromptAgentTool,
  readPromptToolsAgentTool,
  writePromptToolsAgentTool,
  runPlaygroundAgentTool,
  readPlaygroundOutputAgentTool,
  setVariableValuesAgentTool,
  batchSpanAnnotateAgentTool,
  openCodeEvaluatorFormAgentTool,
  readCodeEvaluatorDraftAgentTool,
  editCodeEvaluatorDraftAgentTool,
  testCodeEvaluatorDraftAgentTool,
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
