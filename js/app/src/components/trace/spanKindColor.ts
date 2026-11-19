/**
 * The base color for each span kind as defined by openinference.
 *
 * The SpanKindIcon (as in the trace tree) derives its theme-aware
 * background, border, and foreground colors from these base values. The
 * SpanKindBadge does not: it takes a categorical Badge color per kind (see
 * SPAN_KIND_BADGE_COLORS).
 */
const spanKindColorMap: Record<string, string> = {
  llm: "var(--global-color-orange-500)",
  prompt: "var(--global-color-orange-400)",
  chain: "var(--global-color-blue-500)",
  retriever: "var(--global-color-seafoam-500)",
  reranker: "var(--global-color-celery-500)",
  embedding: "var(--global-color-indigo-500)",
  agent: "var(--global-color-gray-500)",
  tool: "var(--global-color-yellow-500)",
  evaluator: "var(--global-color-indigo-500)",
  guardrail: "var(--global-color-fuchsia-500)",
  decision: "var(--global-color-orange-600)",
};

export function getSpanKindColor({ spanKind }: { spanKind: string }): string {
  return spanKindColorMap[spanKind] ?? "var(--global-color-gray-300)";
}
