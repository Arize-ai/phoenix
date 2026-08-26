import { z } from "zod";

import type { AgentClientAction, AgentStore } from "@phoenix/store/agentStore";

import { annotationConfigOperations } from "./operations/annotationConfig";
import { codeEvaluatorDraftOperations } from "./operations/codeEvaluatorDraft";
import { datasetEvaluatorOperations } from "./operations/datasetEvaluators";
import { datasetLabelOperations } from "./operations/datasetLabels";
import { datasetSplitOperations } from "./operations/datasetSplits";
import { datasetWriteOperations } from "./operations/datasetWrites";
import { experimentOperations } from "./operations/experiment";
import { llmEvaluatorDraftOperations } from "./operations/llmEvaluatorDraft";
import { navigationOperations } from "./operations/navigation";
import { playgroundLoadDatasetOperations } from "./operations/playgroundLoadDataset";
import { playgroundModelOperations } from "./operations/playgroundModel";
import { playgroundPromptOperations } from "./operations/playgroundPrompt";
import { playgroundPromptToolsOperations } from "./operations/playgroundPromptTools";
import { playgroundRunOperations } from "./operations/playgroundRun";
import { playgroundSavePromptOperations } from "./operations/playgroundSavePrompt";
import { playgroundSettingsOperations } from "./operations/playgroundSettings";
import { setTimeRangeOperation } from "./operations/setTimeRange";
import { spanOperations } from "./operations/spans";
import { spansFilterOperations } from "./operations/spansFilter";
import type {
  UIOperationCallContext,
  UIOperationDescriptor,
  UIOperationHandler,
} from "./types";

/**
 * Every operation PXI can execute, whether or not its UI surface is
 * currently mounted. Statically importable so `search_browser_actions` can describe
 * operations on other pages and tell the agent how to reach them.
 */
const knownUIOperations: UIOperationDescriptor[] = [
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
  ...datasetWriteOperations,
  ...datasetSplitOperations,
  ...datasetLabelOperations,
  ...annotationConfigOperations,
  ...experimentOperations,
  ...spanOperations,
  ...navigationOperations,
];

/**
 * Handlers for mounted operations live in the agent store's
 * `registeredClientActions` record, keyed by operation name. Reusing the
 * store record (rather than a module-scoped map) preserves the
 * subscription-based waiters (`waitForRegisteredClientActions`) that quick
 * actions use to await a page's operations after navigation.
 */

/**
 * One operation to mount: the catalog descriptor paired with the handler that
 * services it. The generic ties the handler's input type to the descriptor's
 * schema, so a mismatched pair is a compile error at the registration site.
 */
export type UIOperationBinding<TSchema extends z.ZodType = z.ZodType> = {
  descriptor: UIOperationDescriptor<TSchema>;
  handler: UIOperationHandler<z.infer<TSchema>>;
};

/**
 * Register the handlers for a batch of operations while their UI surface is
 * mounted, and return the matching unregister-all cleanup. One surface (the
 * app root, a page, a dialog) makes one call on mount and calls the returned
 * function on unmount, so the registered and unregistered sets can never
 * drift apart. In an effect this collapses to
 * `useEffect(() => registerUIOperations({ agentStore, operations }), [deps])`.
 *
 * The mapped tuple lets each element carry its own schema type, so every
 * descriptor/handler pair is checked independently.
 * @param params.agentStore - store whose client-action record hosts handlers
 * @param params.operations - descriptor/handler pairs to mount together
 */
export function registerUIOperations<TSchemas extends readonly z.ZodType[]>({
  agentStore,
  operations,
}: {
  agentStore: AgentStore;
  operations: { [K in keyof TSchemas]: UIOperationBinding<TSchemas[K]> };
}): () => void {
  for (const { descriptor, handler } of operations) {
    // The input type is erased at the store boundary; dispatch re-establishes
    // it by validating against the descriptor's schema before invoking.
    const action: AgentClientAction = (input, context) =>
      (handler as UIOperationHandler<unknown>)(
        input,
        context as UIOperationCallContext
      );
    agentStore.getState().registerClientAction(descriptor.name, action);
  }
  return () => {
    for (const { descriptor } of operations) {
      agentStore.getState().unregisterClientAction(descriptor.name);
    }
  };
}

/**
 * Every catalog operation name, in catalog order. Shipped to the script
 * worker so the `ui` proxy's `in`/`Object.keys` introspection answers from
 * the real catalog.
 */
export function listUIOperationNames(): string[] {
  return knownUIOperations.map((operation) => operation.name);
}

export function getUIOperationDescriptor(
  name: string
): UIOperationDescriptor | undefined {
  return knownUIOperations.find((operation) => operation.name === name);
}

export function getMountedUIOperationHandler(
  agentStore: AgentStore,
  name: string
): AgentClientAction | undefined {
  return agentStore.getState().registeredClientActions[name];
}

export function isUIOperationMounted(
  agentStore: AgentStore,
  name: string
): boolean {
  return name in agentStore.getState().registeredClientActions;
}

/** One `search_browser_actions` result: the descriptor plus current availability. */
export type UIOperationSearchResult = {
  descriptor: UIOperationDescriptor;
  isMounted: boolean;
};

/**
 * Return the complete catalog, ranked. The query never filters — it only
 * ranks: operations matching more query tokens (case-insensitive substring
 * match over name and description) sort first. At catalog scale (~60
 * operations) returning everything is cheaper than teaching the model that
 * results are partial: token-OR matching made almost any multi-word query
 * match almost everything anyway, and a model that believes results are
 * query-scoped issues one search per concept, burning a full turn each time.
 * One comprehensive result makes a second search visibly pointless.
 *
 * Results are likewise never filtered by mounted-ness: hiding an operation
 * because it is not usable on the current page reads to the model as "does
 * not exist", and the operations most likely to be unmounted are exactly the
 * ones that mount after an action it is planning (opening a form,
 * navigating). Mounted-ness is a ranking signal — within equal relevance,
 * usable operations sort first — and every result states its availability.
 * @param params.agentStore - store consulted for mounted-ness
 * @param params.query - free-text ranking hint; empty or whitespace ranks by
 * mounted-ness alone
 */
export function searchUIOperations({
  agentStore,
  query,
}: {
  agentStore: AgentStore;
  query: string;
}): UIOperationSearchResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return knownUIOperations
    .map((descriptor) => {
      const haystack =
        `${descriptor.name} ${descriptor.description}`.toLowerCase();
      const matchCount = tokens.filter((token) =>
        haystack.includes(token)
      ).length;
      return {
        descriptor,
        matchCount,
        isMounted: isUIOperationMounted(agentStore, descriptor.name),
      };
    })
    .sort(
      (left, right) =>
        right.matchCount - left.matchCount ||
        Number(right.isMounted) - Number(left.isMounted)
    )
    .map(({ descriptor, isMounted }) => ({ descriptor, isMounted }));
}

/**
 * Levenshtein edit distance, two-row DP. Catalog names are short (≤30
 * chars) and there are ~60 of them, so the quadratic cost is nothing.
 */
function editDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

const MAX_OPERATION_NAME_SUGGESTIONS = 5;

/**
 * Suggest catalog names for an unknown operation name — the top
 * {@link MAX_OPERATION_NAME_SUGGESTIONS} by edit distance, so dispatch
 * errors read "did you mean" instead of dumping a namespace. A candidate is
 * scored against both its full name and its same-segment-count suffix, so a
 * dropped namespace still ranks its target first: `prompt.readt` is one
 * edit from the `prompt.read` suffix of `playground.prompt.read` even
 * though it is far from the full name.
 */
export function suggestUIOperationNames(unknownName: string): string[] {
  const unknown = unknownName.toLowerCase();
  const unknownSegmentCount = unknown.split(".").filter(Boolean).length;
  return knownUIOperations
    .map(({ name }) => {
      const candidate = name.toLowerCase();
      const suffix = candidate.split(".").slice(-unknownSegmentCount).join(".");
      return {
        name,
        score: Math.min(
          editDistance(unknown, candidate),
          editDistance(unknown, suffix)
        ),
      };
    })
    .sort(
      (left, right) =>
        left.score - right.score || left.name.localeCompare(right.name)
    )
    .slice(0, MAX_OPERATION_NAME_SUGGESTIONS)
    .map(({ name }) => name);
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
 * conversion still fails — `search_browser_actions` must never crash on a schema.
 */
function toJsonSchemaNode(
  schema: z.ZodType,
  io: "input" | "output" = "input"
): JsonSchemaNode | undefined {
  try {
    return z.toJSONSchema(schema, {
      io,
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
 * `search_browser_actions` output format. Signatures cost far fewer model tokens than raw
 * JSON schema and read as the exact API the model writes scripts against.
 */
export function renderUIOperationSignature({
  descriptor,
  isMounted,
}: UIOperationSearchResult): string {
  const availability = isMounted
    ? "available on the current page"
    : `not on this page — requires ${descriptor.availability?.routeHint ?? "a different page"}`;
  const approvalNote =
    descriptor.operationKind === "approval"
      ? " Stages a change the user must accept; the returned promise resolves with the decision."
      : "";
  const inputType = renderInlineType(toJsonSchemaNode(descriptor.inputSchema));
  // Declared output shapes render as `UIResult<T>`; operations without one
  // stay `UIResult` (output: unknown).
  const outputType =
    descriptor.outputSchema != null
      ? renderInlineType(toJsonSchemaNode(descriptor.outputSchema, "output"))
      : null;
  const resultType =
    outputType != null ? `UIResult<${outputType}>` : "UIResult";
  return [
    "/**",
    ` * ${descriptor.description}`,
    ` * kind: ${descriptor.operationKind}; ${availability}.${approvalNote}`,
    " */",
    `ui.${descriptor.name}(input: ${inputType}): Promise<${resultType}>;`,
  ].join("\n");
}

/**
 * Render search results as one catalog block for the `search_browser_actions` output.
 * The header says the catalog is complete so the model has no reason to
 * search again with a reworded query — every call returns the same
 * operations, only re-ranked.
 */
export function renderUIOperationCatalog(
  results: UIOperationSearchResult[]
): string {
  if (results.length === 0) {
    return "The UI operation catalog is empty.";
  }
  const signatures = results.map(renderUIOperationSignature).join("\n\n");
  return [
    `// Complete catalog: all ${results.length} UI operations, best query matches first.\n` +
      "// Further search_browser_actions calls return these same operations re-ranked — reuse\n" +
      "// this catalog instead of searching again. Only per-operation availability\n" +
      '// ("available on the current page") changes, after navigation.',
    "// UIResult<T = unknown> = { ok: true; output: T } | { ok: false; code?: ErrorCode; error: string }\n" +
      '// ErrorCode = "UNKNOWN_OPERATION" | "NOT_AVAILABLE" | "INVALID_INPUT" | "CAPABILITY_DISABLED"\n' +
      '//   | "NO_SESSION" | "HANDLER_ERROR" | "NOT_FOUND" | "STALE_REVISION" | "NO_RUN_OUTPUT"\n' +
      "// Branch on `code` (stable), not on the `error` prose (for humans).",
    signatures,
  ].join("\n\n");
}
