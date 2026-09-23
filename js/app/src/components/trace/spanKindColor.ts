/**
 * The base color for each span kind as defined by openinference.
 *
 * This is the single source of truth for span kind colors — both the
 * SpanKindToken and the SpanKindIcon derive their theme-aware background,
 * border, and foreground colors from these base values so that the two
 * treatments stay visually consistent.
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
};

export function getSpanKindColor({ spanKind }: { spanKind: string }): string {
  return spanKindColorMap[spanKind] ?? "var(--global-color-gray-300)";
}
