/**
 * System prompt lines describing the documentation tools.
 * Merged into the agent system prompt alongside other tool guidance.
 *
 * Each tool is expressed as an XML block so the model can cleanly separate
 * tool definitions from other guidance. See
 * app/src/agent/chat/systemPrompt.ts for the overall prompt structure.
 */
export const DOCS_TOOL_SYSTEM_PROMPT_LINES = [
  '<tool name="search_phoenix">',
  "  <description>Search the Phoenix documentation for relevant information.</description>",
  "  <when_to_use>The user asks about Phoenix features, setup, APIs, configuration, or troubleshooting.</when_to_use>",
  "</tool>",
  '<tool name="get_page_phoenix">',
  "  <description>Retrieve the full content of a specific documentation page by path.</description>",
  "  <when_to_use>You need detailed information from a known docs page.</when_to_use>",
  "</tool>",
  "<documentation_usage>",
  "  Use the documentation tools proactively when answering questions about Phoenix. Search first, then fetch specific pages if needed for deeper detail. Always cite the documentation when providing answers based on search results.",
  "</documentation_usage>",
] as const;
