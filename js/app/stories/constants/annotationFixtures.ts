import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";

/**
 * Configs for the fixture evals. `tone` sets no optimization direction, so
 * its values stay untinted.
 */
export const annotationConfigsByName = new Map<
  string,
  AnnotationOptimizationConfig
>([
  [
    "hallucination",
    {
      annotationType: "CATEGORICAL",
      optimizationDirection: "MINIMIZE",
      values: [
        { label: "hallucinated", score: 1 },
        { label: "factual", score: 0 },
      ],
    },
  ],
  [
    "relevance",
    {
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "relevant", score: 1 },
        { label: "unrelated", score: 0 },
      ],
    },
  ],
  [
    "faithfulness",
    {
      annotationType: "CONTINUOUS",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 1,
    },
  ],
  [
    "toxicity",
    {
      annotationType: "CONTINUOUS",
      optimizationDirection: "MINIMIZE",
      lowerBound: 0,
      upperBound: 1,
    },
  ],
  [
    "qa_correctness",
    {
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "correct", score: 1 },
        { label: "incorrect", score: 0 },
      ],
    },
  ],
  [
    "user_feedback",
    {
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "positive", score: 1 },
        { label: "negative", score: 0 },
      ],
    },
  ],
  [
    "tool_success",
    {
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "pass", score: 1 },
        { label: "fail", score: 0 },
      ],
    },
  ],
  ["tone", { annotationType: "CATEGORICAL", optimizationDirection: "NONE" }],
]);

export type SpanAnnotationFixture = {
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
  annotatorKind: "LLM" | "HUMAN" | "CODE";
};

/**
 * The evals run over the RAG trace, by span id. The retriever and the draft
 * were flagged; the final answer passed everything.
 */
export const spanAnnotationsBySpanId: Record<string, SpanAnnotationFixture[]> =
  {
    query: [
      {
        name: "user_feedback",
        label: "positive",
        score: 1,
        explanation: "Customer marked the answer helpful.",
        annotatorKind: "HUMAN",
      },
      {
        name: "qa_correctness",
        label: "correct",
        score: 1,
        explanation: "The final answer matches the policy document.",
        annotatorKind: "LLM",
      },
    ],
    retrieve: [
      {
        name: "relevance",
        label: "unrelated",
        score: 0,
        explanation:
          "None of the four retrieved chunks mention the refund window the question asks about; they cover shipping rates.",
        annotatorKind: "LLM",
      },
    ],
    "llm-draft": [
      {
        name: "hallucination",
        label: "hallucinated",
        score: 1,
        explanation:
          "The draft states a 45-day refund window. The retrieved context gives no window, so the figure is unsupported.",
        annotatorKind: "LLM",
      },
      {
        name: "faithfulness",
        label: null,
        score: 0.31,
        explanation:
          "Two of the three claims in the draft cannot be traced back to the context.",
        annotatorKind: "LLM",
      },
      {
        name: "faithfulness",
        label: null,
        score: 0.4,
        explanation: "One claim is unsupported.",
        annotatorKind: "HUMAN",
      },
      {
        name: "toxicity",
        label: null,
        score: 0.02,
        explanation: null,
        annotatorKind: "CODE",
      },
      {
        name: "tone",
        label: "formal",
        score: null,
        explanation: null,
        annotatorKind: "LLM",
      },
    ],
    "llm-critique": [
      {
        name: "faithfulness",
        label: null,
        score: 0.88,
        explanation:
          "The critique correctly identifies the unsupported refund figure.",
        annotatorKind: "LLM",
      },
    ],
    "llm-final": [
      {
        name: "hallucination",
        label: "factual",
        score: 0,
        explanation:
          "Every claim in the answer is supported by the retrieved context.",
        annotatorKind: "LLM",
      },
      {
        name: "faithfulness",
        label: null,
        score: 0.97,
        explanation: "All three claims trace to the context.",
        annotatorKind: "LLM",
      },
      {
        name: "toxicity",
        label: null,
        score: 0.01,
        explanation: null,
        annotatorKind: "CODE",
      },
      {
        name: "relevance",
        label: "relevant",
        score: 1,
        explanation: "The answer addresses the refund question directly.",
        annotatorKind: "HUMAN",
      },
    ],
  };

/** Summarizes a span's annotations by name the way the API does. */
export function summarizeSpanAnnotations(
  annotations: readonly SpanAnnotationFixture[]
): AnnotationSummary[] {
  const byName = new Map<string, SpanAnnotationFixture[]>();
  annotations.forEach((annotation) => {
    byName.set(annotation.name, [
      ...(byName.get(annotation.name) ?? []),
      annotation,
    ]);
  });
  return [...byName.entries()].map(([name, group]) => {
    const scores = group.flatMap((annotation) =>
      annotation.score == null ? [] : [annotation.score]
    );
    const labels = group.flatMap((annotation) =>
      annotation.label == null ? [] : [annotation.label]
    );
    return {
      name,
      count: group.length,
      meanScore:
        scores.length > 0
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : null,
      labelFractions: [...new Set(labels)].map((label) => ({
        label,
        fraction:
          labels.filter((candidate) => candidate === label).length /
          labels.length,
      })),
    };
  });
}

/**
 * The annotations of one span as the preview's details query returns them:
 * ids and creation times added, newest last. Defaults to the RAG trace's
 * annotations for that span id.
 */
export function buildSpanAnnotationRecords(
  spanId: string,
  annotations: readonly SpanAnnotationFixture[] = spanAnnotationsBySpanId[
    spanId
  ] ?? []
) {
  const annotatedAt = Date.parse("2026-09-22T09:31:00.000Z");
  return annotations.map((annotation, index) => ({
    id: `${spanId}-annotation-${index}`,
    ...annotation,
    createdAt: new Date(annotatedAt + index * 1000).toISOString(),
  }));
}
