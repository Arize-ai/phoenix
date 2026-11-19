import { Badge } from "@phoenix/components/core/badge";
import type { FamilySize } from "@phoenix/components/core/types";

import { getSpanKindColor } from "./spanKindColor";
import { SpanKindIcon } from "./SpanKindIcon";

/**
 * What each OpenInference span kind stands for, worded as in the span kinds
 * docs, for the places that explain a kind.
 */
const SPAN_KIND_EXPLANATIONS: Record<string, string> = {
  llm: "A call to a large language model.",
  chain: "A starting point or a link between steps of an LLM application.",
  agent: "A wrapper around the LLM and tool calls of an agent loop.",
  tool: "A call to an external tool, API or function on behalf of an LLM.",
  retriever: "A query for context from a data store, such as a vector DB.",
  embedding: "An encoding of unstructured data into a vector.",
  reranker: "A relevance-based reordering of documents.",
  guardrail: "A check of LLM input or output for safety, policy or compliance.",
  evaluator: "An evaluation: its type, configuration and results.",
  decision:
    "A call to a decision model, which scores or selects among the options it is given.",
  prompt: "The construction or templating of a prompt.",
};

/**
 * A short explanation of a span kind, or a note that the span sets none.
 */
export function getSpanKindExplanation(spanKind: string): string {
  return (
    SPAN_KIND_EXPLANATIONS[spanKind] ??
    "The span does not set an OpenInference span kind."
  );
}

/**
 * A span's kind, led by its span kind icon, both in the kind's color from the
 * span kind palette the trace tree uses, so a kind reads the same everywhere.
 * This is a deliberate exception to the Badge rule against orange: LLM spans
 * have been orange across Phoenix since long before the Badge family, and
 * the trace tree has never had it read as a warning.
 */
export function SpanKindBadge({
  spanKind,
  size = "M",
}: {
  spanKind: string;
  size?: FamilySize;
}) {
  return (
    <Badge
      paletteColor={getSpanKindColor({ spanKind })}
      size={size}
      leadingVisual={
        <SpanKindIcon spanKind={spanKind} size={size} variant="outline" />
      }
    >
      {spanKind}
    </Badge>
  );
}
