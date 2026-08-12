import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { renderUiOperationCatalog, searchUiOperations } from "./catalog";

export const SEARCH_UI_TOOL_NAME = "search_ui";

type SearchUiInput = {
  query: string;
};

function parseSearchUiInput(input: unknown): SearchUiInput | null {
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
 * `search_ui`: discover UI operations and their signatures. One of the two
 * meta-tools that replace the per-operation client-action tools; the model
 * searches here first, then composes what it found into an `execute_ui`
 * script.
 *
 * RFC note: not yet listed in `toolRegistry.ts` — inert until the rollout
 * capability lands.
 */
export const searchUiAgentTool = defineTool<SearchUiInput>({
  name: SEARCH_UI_TOOL_NAME,
  parseInput: parseSearchUiInput,
  invalidInputErrorText:
    "Invalid search_ui input. Expected { query?: string }.",
  // Pure catalog read with no side effects: always safe to re-dispatch when
  // an unresolved call is found on session load or after a session sync.
  rehydratable: true,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const results = searchUiOperations({
      agentStore,
      query: input.query,
    });
    await addToolOutput({
      state: "output-available",
      tool: SEARCH_UI_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: renderUiOperationCatalog(results),
    });
  },
});
