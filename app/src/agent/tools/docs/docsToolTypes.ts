/**
 * Input shape for the search_phoenix tool.
 */
export type DocsSearchInput = {
  query: string;
};

/**
 * Input shape for the query_docs_filesystem_phoenix tool.
 */
export type DocsFileSystemQueryInput = {
  command: string;
};

/**
 * Output from docs tools is a string (the search results or command output).
 * The MCP server returns text content.
 */
export type DocsToolOutput = string;

export const DOCS_SEARCH_TOOL_NAME = "search_phoenix";
export const DOCS_FILESYSTEM_QUERY_TOOL_NAME = "query_docs_filesystem_phoenix";

/**
 * Names of backend docs tools. Used for rendering dispatch.
 */
export const DOCS_TOOL_NAMES = [
  DOCS_SEARCH_TOOL_NAME,
  DOCS_FILESYSTEM_QUERY_TOOL_NAME,
] as const;
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
    typeof input.query === "string"
  ) {
    return { query: input.query };
  }
  return null;
}

/**
 * Parse the query_docs_filesystem_phoenix tool input from the raw AI SDK part input.
 */
export function parseDocsFileSystemQueryInput(
  input: unknown
): DocsFileSystemQueryInput | null {
  if (
    typeof input === "object" &&
    input !== null &&
    "command" in input &&
    typeof input.command === "string"
  ) {
    return { command: input.command };
  }
  return null;
}
