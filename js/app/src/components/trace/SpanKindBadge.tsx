import type { BadgeColor } from "@phoenix/components/core/badge";
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
 * The categorical hue of each span kind's Badge. Span kind is a nominal axis,
 * so each kind gets a color of its own that encodes its identity, never
 * green, orange or red (a green kind would read as "OK"). LLM, agent and
 * decision match the annotator kinds of the same name. There are fewer hues
 * than kinds, so the rarer reranker and prompt kinds stay neutral, as does a
 * span without a kind.
 */
export const SPAN_KIND_BADGE_COLORS: Record<string, BadgeColor> = {
  llm: "purple",
  chain: "blue",
  retriever: "cyan",
  embedding: "indigo",
  agent: "seafoam",
  tool: "yellow",
  guardrail: "fuchsia",
  evaluator: "chartreuse",
  decision: "magenta",
  reranker: "neutral",
  prompt: "neutral",
};

/**
 * The Badge color for a span kind; `neutral` for a kind Phoenix does not
 * know.
 */
export function getSpanKindBadgeColor(spanKind: string): BadgeColor {
  return SPAN_KIND_BADGE_COLORS[spanKind] ?? "neutral";
}

/**
 * A span's kind, in the kind's own Badge color, led by its span kind icon
 * drawn in that same color. The trace tree's square icons keep their own
 * span kind palette.
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
      color={getSpanKindBadgeColor(spanKind)}
      size={size}
      leadingVisual={
        <SpanKindIcon spanKind={spanKind} size={size} variant="outline" />
      }
    >
      {spanKind}
    </Badge>
  );
}
