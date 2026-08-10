import { z } from "zod";

import { setTimeRangeOperation } from "./operations/setTimeRange";
import type { UiOperationDescriptor, UiOperationHandler } from "./types";

/**
 * Every operation PXI can ever execute, whether or not its UI surface is
 * currently mounted. Statically importable so `search_ui` can describe
 * operations on other pages and tell the agent how to reach them.
 *
 * RFC note: in the real implementation this list (and the mounted-handler
 * registry below) would live on the agent store next to
 * `registeredClientActions`, and grow one entry per migrated tool.
 */
const knownUiOperations: UiOperationDescriptor[] = [setTimeRangeOperation];

/**
 * Handlers registered by currently-mounted components, keyed by operation
 * name. Mirrors `agentStore.registeredClientActions` — module-scoped here to
 * keep the RFC self-contained.
 */
const mountedHandlers = new Map<string, UiOperationHandler<unknown>>();

/**
 * Register the handler for an operation while its UI surface is mounted.
 * The generic ties the handler's input type to the descriptor's schema, so a
 * mismatched pair is a compile error at the registration site.
 */
export function registerUiOperation<TSchema extends z.ZodType>({
  descriptor,
  handler,
}: {
  descriptor: UiOperationDescriptor<TSchema>;
  handler: UiOperationHandler<z.infer<TSchema>>;
}): void {
  // The input type is erased at the map boundary; dispatch re-establishes it
  // by validating against the descriptor's schema before invoking.
  mountedHandlers.set(descriptor.name, handler as UiOperationHandler<unknown>);
}

export function unregisterUiOperation(name: string): void {
  mountedHandlers.delete(name);
}

export function getUiOperationDescriptor(
  name: string
): UiOperationDescriptor | undefined {
  return knownUiOperations.find((operation) => operation.name === name);
}

export function getMountedUiOperationHandler(
  name: string
): UiOperationHandler<unknown> | undefined {
  return mountedHandlers.get(name);
}

export function isUiOperationMounted(name: string): boolean {
  return mountedHandlers.has(name);
}

/** One `search_ui` result: the descriptor plus current availability. */
export type UiOperationSearchResult = {
  descriptor: UiOperationDescriptor;
  isMounted: boolean;
};

/**
 * Search the catalog by case-insensitive token match over name and
 * description. An empty query returns the full catalog (the table of
 * contents). At catalog scale (~60 operations) substring scoring is enough —
 * no index or embeddings.
 * @param params.query - free-text query; empty or whitespace matches all
 * @param params.mountedOnly - restrict to operations usable on this page
 */
export function searchUiOperations({
  query,
  mountedOnly = false,
}: {
  query: string;
  mountedOnly?: boolean;
}): UiOperationSearchResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return knownUiOperations
    .map((descriptor) => {
      const haystack =
        `${descriptor.name} ${descriptor.description}`.toLowerCase();
      const matchCount = tokens.filter((token) =>
        haystack.includes(token)
      ).length;
      return { descriptor, matchCount };
    })
    .filter(({ descriptor, matchCount }) => {
      const isMatch = tokens.length === 0 || matchCount > 0;
      const isAvailable = !mountedOnly || isUiOperationMounted(descriptor.name);
      return isMatch && isAvailable;
    })
    .sort((left, right) => right.matchCount - left.matchCount)
    .map(({ descriptor }) => ({
      descriptor,
      isMounted: isUiOperationMounted(descriptor.name),
    }));
}

/**
 * Suggest catalog names for an unknown operation name, so dispatch errors are
 * actionable ("Did you mean...?") instead of dead ends.
 */
export function suggestUiOperationNames(unknownName: string): string[] {
  const segments = unknownName.toLowerCase().split(".").filter(Boolean);
  const suggestions = knownUiOperations
    .map((operation) => operation.name)
    .filter((name) => {
      const candidate = name.toLowerCase();
      return segments.some(
        (segment) => candidate.includes(segment) || segment.includes(candidate)
      );
    });
  return suggestions.length > 0
    ? suggestions
    : knownUiOperations.map((operation) => operation.name);
}

/**
 * Minimal JSON-schema shape produced by `z.toJSONSchema` for the subset of
 * schema features operations use. Anything unrecognized renders as `unknown`.
 */
type JsonSchemaNode = {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaNode | undefined>;
  required?: string[];
  items?: JsonSchemaNode;
};

function renderInlineType(node: JsonSchemaNode | undefined): string {
  if (node == null) {
    return "unknown";
  }
  if (Array.isArray(node.enum)) {
    return node.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (node.type === "object" && node.properties != null) {
    const required = new Set(node.required ?? []);
    const fields = Object.entries(node.properties).map(
      ([propertyName, propertySchema]) => {
        const optionalMarker = required.has(propertyName) ? "" : "?";
        return `${propertyName}${optionalMarker}: ${renderInlineType(propertySchema)}`;
      }
    );
    return `{ ${fields.join("; ")} }`;
  }
  if (node.type === "array") {
    return `${renderInlineType(node.items)}[]`;
  }
  if (
    node.type === "string" ||
    node.type === "number" ||
    node.type === "boolean"
  ) {
    return node.type;
  }
  return "unknown";
}

/**
 * Render one operation as a `.d.ts`-style signature with a doc comment — the
 * `search_ui` output format. Signatures cost far fewer model tokens than raw
 * JSON schema and read as the exact API the model writes scripts against.
 */
export function renderUiOperationSignature({
  descriptor,
  isMounted,
}: UiOperationSearchResult): string {
  const availability = isMounted
    ? "available on the current page"
    : `not on this page — requires ${descriptor.availability?.routeHint ?? "a different page"}`;
  const inputType = renderInlineType(
    z.toJSONSchema(descriptor.inputSchema) as JsonSchemaNode
  );
  return [
    "/**",
    ` * ${descriptor.description}`,
    ` * kind: ${descriptor.kind}; ${availability}`,
    " */",
    `ui.${descriptor.name}(input: ${inputType}): Promise<UiResult>;`,
  ].join("\n");
}

/** Render search results as one catalog block for the `search_ui` output. */
export function renderUiOperationCatalog(
  results: UiOperationSearchResult[]
): string {
  if (results.length === 0) {
    return "No operations matched. Call search_ui with an empty query to list the full catalog.";
  }
  const signatures = results.map(renderUiOperationSignature).join("\n\n");
  return [
    "// UiResult = { ok: true; output?: string } | { ok: false; error: string }",
    signatures,
  ].join("\n\n");
}
