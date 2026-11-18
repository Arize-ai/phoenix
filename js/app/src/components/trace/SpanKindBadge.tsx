import { Badge } from "@phoenix/components/core/badge";
import type { FamilySize } from "@phoenix/components/core/types";

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
 * A span's kind: its square span kind icon, which carries the kind's color,
 * and its name. The badge itself stays neutral so the icon is the one place
 * the kind's color appears, as it does in the trace tree.
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
      size={size}
      leadingVisual={<SpanKindIcon spanKind={spanKind} size={size} />}
    >
      {spanKind}
    </Badge>
  );
}
