import { batchSpanAnnotateInputSchema } from "@phoenix/agent/tools/batchSpanAnnotate/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entry replacing the standalone `batch_span_annotate` tool. An
 * approval operation registered at the app root; the staged batch renders in
 * the annotation approval card and the promise resolves with the user's
 * decision. The input schema is reused from the existing tool module; the
 * description folds in the durable guidance from the retired per-tool
 * instruction template.
 */
export const batchSpanAnnotateOperation = defineUiOperation({
  name: "spans.annotate",
  description:
    "Write structured feedback annotations to one or more Phoenix spans. Use this only when " +
    "the user wants annotations saved, not for ordinary analysis. Each entry targets a span " +
    "by spanId or spanNodeId (use ids from context or prior results — never guess), with a " +
    "stable lowercase snake_case name for the metric dimension (e.g. code_quality — put " +
    "outcomes in label/score, never in the name) and at least one of label, score, or " +
    "explanation; include an explanation for any judgment worth auditing later. Batch related " +
    "annotations into one call, targeting the most specific relevant span (LLM spans for " +
    "model output, tool spans for tool behavior, retriever spans for retrieval quality; root " +
    "spans only for end-to-end judgments). Annotations are keyed by (name, span, identifier): " +
    "reuse the same name and identifier to update one, or distinct identifiers (e.g. " +
    "evaluator:v1) for multiple annotations with the same name. Set annotatorKind to LLM " +
    "(default) for your own judgment, HUMAN when recording explicit user feedback, or CODE " +
    "for deterministic checks. The name 'note' is reserved for span notes.",
  inputSchema: batchSpanAnnotateInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
});

/** All span operations, for catalog assembly and root registration. */
export const spanOperations: UiOperationDescriptor[] = [
  batchSpanAnnotateOperation,
];
