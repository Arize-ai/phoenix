import { getToolName } from "ai";

import {
  isDocsToolName,
  parseDocsGetPageInput,
  parseDocsSearchInput,
} from "@phoenix/agent/tools/docs";

import type { ToolInvocationPart, ToolUIPartState } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

/**
 * Maximum number of characters to show in the collapsed output preview.
 */
const OUTPUT_PREVIEW_LENGTH = 200;

/**
 * Returns the preview text for the collapsed docs tool summary.
 */
export function getDocsToolPreview(part: ToolInvocationPart): string {
  const toolName = getToolName(part);
  if (toolName === "search_phoenix") {
    const input = parseDocsSearchInput(part.input);
    return input ? `Searching: ${input.query}` : "";
  }
  if (toolName === "get_page_phoenix") {
    const input = parseDocsGetPageInput(part.input);
    return input ? `Fetching: ${input.page}` : "";
  }
  return "";
}

/**
 * Formats a docs tool state into a human-readable label.
 */
export function formatDocsToolState(
  state: ToolUIPartState,
  part: ToolInvocationPart
): string {
  const toolName = getToolName(part);
  switch (state) {
    case "input-streaming":
      return toolName === "get_page_phoenix" ? "Fetching…" : "Searching…";
    case "input-available":
      return "Running…";
    case "output-available":
      return "Done";
    case "output-error":
      return "Failed";
    default:
      return formatToolState(state);
  }
}

/**
 * Expanded detail view for a docs tool invocation showing the query or page
 * path and, when available, the text output from the MCP server.
 */
export function DocsToolDetails({ part }: { part: ToolInvocationPart }) {
  const toolName = getToolName(part);
  const isSearch = toolName === "search_phoenix";

  const inputLabel = isSearch ? "Query" : "Page";
  const inputText = getInputText(part, isSearch);
  const outputText = getOutputText(part);

  return (
    <>
      <span className="tool-part__label">{inputLabel}</span>
      <pre>{inputText || "(empty)"}</pre>
      {part.state === "output-available" ? (
        <>
          <span className="tool-part__label">
            {isSearch ? "Results" : "Content"}
          </span>
          <pre>{outputText || "(no output)"}</pre>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <span className="tool-part__label">Error</span>
          <pre>{part.errorText}</pre>
        </>
      ) : null}
    </>
  );
}

/**
 * Returns true if the given tool name is a docs tool that should be rendered
 * by this component. Re-exported for use by ToolPart dispatch.
 */
export { isDocsToolName };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInputText(part: ToolInvocationPart, isSearch: boolean): string {
  if (isSearch) {
    const input = parseDocsSearchInput(part.input);
    return input?.query ?? stringifyToolValue(part.input);
  }
  const input = parseDocsGetPageInput(part.input);
  return input?.page ?? stringifyToolValue(part.input);
}

function getOutputText(part: ToolInvocationPart): string {
  if (part.state !== "output-available" || part.output == null) {
    return "";
  }
  return stringifyToolValue(part.output);
}

/**
 * Truncate a docs tool output string for preview contexts.
 */
export function truncateDocsOutput(text: string): string {
  if (text.length <= OUTPUT_PREVIEW_LENGTH) {
    return text;
  }
  return text.slice(0, OUTPUT_PREVIEW_LENGTH) + "…";
}
