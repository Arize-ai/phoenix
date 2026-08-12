import { LazyToolPartFileView } from "./LazyToolPartPierreViews";
import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";

/**
 * Collapsed-row preview for a `search_ui` call: the free-text query, or
 * "full catalog" when the query was empty (an empty query lists every
 * operation).
 */
export function getSearchUiToolPreview(part: ToolInvocationPart): string {
  const input = part.input;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const { query } = input as { query?: unknown };
    if (typeof query === "string" && query.trim() !== "") {
      return query.trim();
    }
  }
  return "full catalog";
}

/**
 * Details for a `search_ui` call. Its output is a `.d.ts`-style catalog string
 * (operation signatures with doc comments), so render it verbatim as a code
 * file — syntax-highlighted, newlines preserved — rather than letting the
 * generic renderer `JSON.stringify` it into one escaped line. A broad query
 * can return the whole catalog, so wrap it in the collapsing section other
 * long tool bodies use.
 */
export function SearchUiToolDetails({ part }: { part: ToolInvocationPart }) {
  if (part.state === "output-error") {
    return (
      <div className="tool-part__body">
        <ToolPartLabel variant="danger">Error</ToolPartLabel>
        <ToolPartExpandableSection>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </ToolPartExpandableSection>
      </div>
    );
  }
  const catalog =
    part.state === "output-available" && typeof part.output === "string"
      ? part.output
      : null;
  return (
    <div className="tool-part__body">
      <ToolPartLabel>Operations</ToolPartLabel>
      {catalog != null ? (
        <ToolPartExpandableSection>
          <LazyToolPartFileView
            fileName="ui-operations.d.ts"
            contents={catalog}
          />
        </ToolPartExpandableSection>
      ) : (
        <ToolPartCodeBlock>Searching…</ToolPartCodeBlock>
      )}
    </div>
  );
}
