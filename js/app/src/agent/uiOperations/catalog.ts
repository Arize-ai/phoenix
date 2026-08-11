import { z } from "zod";

import type { AgentClientAction, AgentStore } from "@phoenix/store/agentStore";

import { codeEvaluatorDraftOperations } from "./operations/codeEvaluatorDraft";
import { datasetEvaluatorOperations } from "./operations/datasetEvaluators";
import { llmEvaluatorDraftOperations } from "./operations/llmEvaluatorDraft";
import { playgroundLoadDatasetOperations } from "./operations/playgroundLoadDataset";
import { playgroundModelOperations } from "./operations/playgroundModel";
import { playgroundPromptOperations } from "./operations/playgroundPrompt";
import { playgroundPromptToolsOperations } from "./operations/playgroundPromptTools";
import { playgroundRunOperations } from "./operations/playgroundRun";
import { playgroundSavePromptOperations } from "./operations/playgroundSavePrompt";
import { playgroundSettingsOperations } from "./operations/playgroundSettings";
import { setTimeRangeOperation } from "./operations/setTimeRange";
import { spansFilterOperations } from "./operations/spansFilter";
import type {
  UiOperationCallContext,
  UiOperationDescriptor,
  UiOperationHandler,
} from "./types";

/**
 * Every operation PXI can execute, whether or not its UI surface is
 * currently mounted. Statically importable so `search_ui` can describe
 * operations on other pages and tell the agent how to reach them.
 */
const knownUiOperations: UiOperationDescriptor[] = [
  setTimeRangeOperation,
  ...spansFilterOperations,
  ...playgroundPromptOperations,
  ...playgroundPromptToolsOperations,
  ...playgroundSavePromptOperations,
  ...playgroundLoadDatasetOperations,
  ...playgroundModelOperations,
  ...playgroundRunOperations,
  ...playgroundSettingsOperations,
  ...datasetEvaluatorOperations,
  ...codeEvaluatorDraftOperations,
  ...llmEvaluatorDraftOperations,
];

/**
 * Handlers for mounted operations live in the agent store's
 * `registeredClientActions` record, keyed by operation name. Reusing the
 * store record (rather than a module-scoped map) preserves the
 * subscription-based waiters (`waitForRegisteredClientActions`) that quick
 * actions use to await a page's operations after navigation.
 */

/**
 * Register the handler for an operation while its UI surface is mounted.
 * The generic ties the handler's input type to the descriptor's schema, so a
 * mismatched pair is a compile error at the registration site.
 */
export function registerUiOperation<TSchema extends z.ZodType>({
  agentStore,
  descriptor,
  handler,
}: {
  agentStore: AgentStore;
  descriptor: UiOperationDescriptor<TSchema>;
  handler: UiOperationHandler<z.infer<TSchema>>;
}): void {
  // The input type is erased at the store boundary; dispatch re-establishes
  // it by validating against the descriptor's schema before invoking.
  const action: AgentClientAction = (input, context) =>
    handler(input as z.infer<TSchema>, context as UiOperationCallContext);
  agentStore.getState().registerClientAction(descriptor.name, action);
}

export function unregisterUiOperation({
  agentStore,
  name,
}: {
  agentStore: AgentStore;
  name: string;
}): void {
  agentStore.getState().unregisterClientAction(name);
}

export function getUiOperationDescriptor(
  name: string
): UiOperationDescriptor | undefined {
  return knownUiOperations.find((operation) => operation.name === name);
}

export function getMountedUiOperationHandler(
  agentStore: AgentStore,
  name: string
): AgentClientAction | undefined {
  return agentStore.getState().registeredClientActions[name];
}

export function isUiOperationMounted(
  agentStore: AgentStore,
  name: string
): boolean {
  return name in agentStore.getState().registeredClientActions;
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
 * @param params.agentStore - store consulted for mounted-ness
 * @param params.query - free-text query; empty or whitespace matches all
 * @param params.mountedOnly - restrict to operations usable on this page
 */
export function searchUiOperations({
  agentStore,
  query,
  mountedOnly = false,
}: {
  agentStore: AgentStore;
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
      const isAvailable =
        !mountedOnly || isUiOperationMounted(agentStore, descriptor.name);
      return isMatch && isAvailable;
    })
    .sort((left, right) => right.matchCount - left.matchCount)
    .map(({ descriptor }) => ({
      descriptor,
      isMounted: isUiOperationMounted(agentStore, descriptor.name),
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
  anyOf?: JsonSchemaNode[];
};

/**
 * Convert a descriptor schema to a JSON-schema node for signature rendering.
 * Renders the *input* side of transforms (what the model sends), maps
 * unrepresentable pieces (custom types, effects) to `{}` instead of
 * throwing, and falls back to `undefined` (rendered `unknown`) if the
 * conversion still fails — `search_ui` must never crash on a schema.
 */
function toJsonSchemaNode(schema: z.ZodType): JsonSchemaNode | undefined {
  try {
    return z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as JsonSchemaNode;
  } catch {
    return undefined;
  }
}

function renderInlineType(node: JsonSchemaNode | undefined): string {
  if (node == null) {
    return "unknown";
  }
  if (Array.isArray(node.enum)) {
    return node.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (Array.isArray(node.anyOf)) {
    return node.anyOf.map(renderInlineType).join(" | ");
  }
  if (node.type === "object" && node.properties != null) {
    const required = new Set(node.required ?? []);
    const fields = Object.entries(node.properties).map(
      ([propertyName, propertySchema]) => {
        const optionalMarker = required.has(propertyName) ? "" : "?";
        return `${propertyName}${optionalMarker}: ${renderInlineType(propertySchema)}`;
      }
    );
    return fields.length > 0 ? `{ ${fields.join("; ")} }` : "{}";
  }
  if (node.type === "array") {
    return `${renderInlineType(node.items)}[]`;
  }
  if (
    node.type === "string" ||
    node.type === "number" ||
    node.type === "integer" ||
    node.type === "boolean"
  ) {
    return node.type === "integer" ? "number" : node.type;
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
  const approvalNote =
    descriptor.kind === "approval"
      ? " Stages a change the user must accept; the returned promise resolves with the decision."
      : "";
  const inputType = renderInlineType(toJsonSchemaNode(descriptor.inputSchema));
  return [
    "/**",
    ` * ${descriptor.description}`,
    ` * kind: ${descriptor.kind}; ${availability}.${approvalNote}`,
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
    "// UiResult = { ok: true; output?: unknown } | { ok: false; error: string }",
    signatures,
  ].join("\n\n");
}
