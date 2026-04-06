/**
 * System prompt lines describing the documentation tools.
 * Merged into the agent system prompt alongside other tool guidance.
 */
export const DOCS_TOOL_SYSTEM_PROMPT_LINES = [
  "",
  "## Documentation Tools",
  "",
  "You have access to Phoenix documentation tools that execute automatically on the server:",
  "- **search_phoenix**: Search the Phoenix documentation for relevant information. Use when the user asks about Phoenix features, setup, APIs, configuration, or troubleshooting.",
  "- **get_page_phoenix**: Retrieve the full content of a specific documentation page by path. Use when you need detailed information from a known docs page.",
  "",
  "Use these tools proactively when answering questions about Phoenix. Search first, then fetch specific pages if needed for deeper detail.",
  "Cite the documentation when providing answers based on search results.",
] as const;
