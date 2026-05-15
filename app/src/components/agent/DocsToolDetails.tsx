import { getToolName } from "ai";

import {
  isDocsToolName,
  parseDocsFileSystemQueryInput,
  parseDocsSearchInput,
} from "@phoenix/agent/tools/docs";

import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
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
  if (toolName === "query_docs_filesystem_phoenix") {
    const input = parseDocsFileSystemQueryInput(part.input);
    return input ? `Running: ${input.command}` : "";
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
      return toolName === "query_docs_filesystem_phoenix"
        ? "Querying…"
        : "Searching…";
    case "input-available":
      return "Running…";
    case "output-available":
      return "Done";
    case "output-error":
      return "Error";
    default:
      return formatToolState(state);
  }
}

/**
 * Expanded detail view for a docs tool invocation showing the search query or
 * filesystem command and, when available, the text output from the MCP server.
 */
export function DocsToolDetails({ part }: { part: ToolInvocationPart }) {
  const toolName = getToolName(part);
  const isSearch = toolName === "search_phoenix";

  const inputLabel = isSearch ? "Query" : "Command";
  const inputText = getInputText(part, isSearch);
  const outputText = getOutputText(part);

  return (
    <div className="tool-part__body">
      <ToolPartLabel>{inputLabel}</ToolPartLabel>
      <ToolPartCodeBlock>{inputText}</ToolPartCodeBlock>
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel>{isSearch ? "Results" : "Output"}</ToolPartLabel>
          <ToolPartCodeBlock>{outputText || "(no output)"}</ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
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
  const input = parseDocsFileSystemQueryInput(part.input);
  return input?.command ?? stringifyToolValue(part.input);
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
