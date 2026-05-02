/**
 * Input shape for the search_phoenix tool.
 */
export type DocsSearchInput = {
  query: string;
};

/**
 * Input shape for the get_page_phoenix tool.
 */
export type DocsGetPageInput = {
  page: string;
};

/**
 * Output from docs tools is a string (the search results or page content).
 * The MCP server returns text content.
 */
export type DocsToolOutput = string;

/**
 * Names of backend docs tools. Used for rendering dispatch.
 */
export const DOCS_TOOL_NAMES = ["search_phoenix", "get_page_phoenix"] as const;
export type DocsToolName = (typeof DOCS_TOOL_NAMES)[number];

export function isDocsToolName(name: string): name is DocsToolName {
  return (DOCS_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Parse the search_phoenix tool input from the raw AI SDK part input.
 */
export function parseDocsSearchInput(input: unknown): DocsSearchInput | null {
  if (
    typeof input === "object" &&
    input !== null &&
    "query" in input &&
    typeof (input as Record<string, unknown>).query === "string"
  ) {
    return input as DocsSearchInput;
  }
  return null;
}

/**
 * Parse the get_page_phoenix tool input from the raw AI SDK part input.
 */
export function parseDocsGetPageInput(input: unknown): DocsGetPageInput | null {
  if (
    typeof input === "object" &&
    input !== null &&
    "page" in input &&
    typeof (input as Record<string, unknown>).page === "string"
  ) {
    return input as DocsGetPageInput;
  }
  return null;
}
