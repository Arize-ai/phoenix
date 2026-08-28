import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { renderUIOperationCatalog, searchUIOperations } from "./catalog";

export const SEARCH_BROWSER_ACTIONS_TOOL_NAME = "search_browser_actions";

type SearchUIInput = {
  query: string;
};

function parseSearchUIInput(input: unknown): SearchUIInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { query?: unknown };
  if (candidate.query !== undefined && typeof candidate.query !== "string") {
    return null;
  }
  return { query: candidate.query ?? "" };
}

/**
 * `search_browser_actions`: discover UI operations and their signatures. One of the two
 * meta-tools that replace the per-operation client-action tools; the model
 * searches here first, then composes what it found into an `execute_browser_action`
 * script.
 *
 * Every call returns the complete catalog with query matches ranked first
 * (see {@link searchUIOperations}), so one call per conversation suffices —
 * the output says so explicitly to stop the model from re-searching with
 * reworded queries.
 *
 * RFC note: not yet listed in `toolRegistry.ts` — inert until the rollout
 * capability lands.
 */
export const searchBrowserActionsTool = defineTool<SearchUIInput>({
  name: SEARCH_BROWSER_ACTIONS_TOOL_NAME,
  parseInput: parseSearchUIInput,
  invalidInputErrorText:
    "Invalid search_browser_actions input. Expected { query?: string }.",
  // Pure catalog read with no side effects: always safe to re-dispatch when
  // an unresolved call is found on session load or after a session sync.
  rehydratable: true,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const results = searchUIOperations({
      agentStore,
      query: input.query,
    });
    await addToolOutput({
      state: "output-available",
      tool: SEARCH_BROWSER_ACTIONS_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: renderUIOperationCatalog(results),
    });
  },
});
