import { describe, expect, it } from "vitest";

import type { EvaluatorResultAnnotation } from "@phoenix/pages/project/evaluators/EvaluatorOutputCell";
import {
  getEvaluatorResultTarget,
  parseEvaluatorOutput,
} from "@phoenix/pages/project/evaluators/EvaluatorOutputCell";

const commonAnnotation = {
  id: "annotation-id",
  name: "relevance",
  label: "relevant",
  score: 1,
  explanation: "The context supports the response.",
  annotatorKind: "LLM",
  createdAt: "2026-09-10T12:00:00Z",
  updatedAt: "2026-09-10T12:00:00Z",
};

describe("getEvaluatorResultTarget", () => {
  it("links span annotations to the selected span", () => {
    const annotation = {
      ...commonAnnotation,
      __typename: "SpanAnnotation",
      span: {
        id: "Span:1",
        trace: {
          traceId: "trace/1",
          project: { id: "Project:1" },
        },
      },
    } satisfies EvaluatorResultAnnotation;

    expect(getEvaluatorResultTarget(annotation)).toEqual({
      annotationTargetType: "span",
      label: "View annotated span",
      path: "/projects/Project%3A1/spans/trace%2F1?selectedSpanNodeId=Span%3A1",
      id: "trace/1",
    });
  });

  it("links trace annotations to the annotated trace", () => {
    const annotation = {
      ...commonAnnotation,
      __typename: "TraceAnnotation",
      trace: {
        traceId: "trace/1",
        project: { id: "Project:1" },
      },
    } satisfies EvaluatorResultAnnotation;

    expect(getEvaluatorResultTarget(annotation)).toEqual({
      annotationTargetType: "trace",
      label: "View annotated trace",
      path: "/projects/Project%3A1/traces/trace%2F1",
      id: "trace/1",
    });
  });

  it("links session annotations to the annotated session", () => {
    const annotation = {
      ...commonAnnotation,
      __typename: "ProjectSessionAnnotation",
      projectSession: {
        id: "ProjectSession:1",
        project: { id: "Project:1" },
      },
    } satisfies EvaluatorResultAnnotation;

    expect(getEvaluatorResultTarget(annotation)).toEqual({
      annotationTargetType: "session",
      label: "View annotated session",
      path: "/projects/Project%3A1/sessions/ProjectSession%3A1",
      id: "ProjectSession:1",
    });
  });
});

describe("parseEvaluatorOutput", () => {
  it("parses the legacy label, score, and explanation output", () => {
    expect(
      parseEvaluatorOutput({
        output:
          "relevant (score=1.0)\n\nThe retrieved context directly supports the response's claims.",
        annotationNames: ["document_relevance"],
        sourceId: "Span:1",
        createdAt: "2026-09-10T12:00:00Z",
      })
    ).toEqual([
      {
        id: "Span:1:result:0",
        name: "document_relevance",
        label: "relevant",
        score: 1,
        explanation:
          "The retrieved context directly supports the response's claims.",
        createdAt: "2026-09-10T12:00:00Z",
      },
    ]);
  });

  it("parses structured multi-result evaluator output", () => {
    expect(
      parseEvaluatorOutput({
        output: JSON.stringify({
          results: [
            {
              name: "quality.relevance",
              label: "relevant",
              score: 1,
              explanation: "Supported by the context.",
            },
            {
              name: "quality.style",
              label: "clear",
              score: 0.9,
              explanation: "The response is concise.",
            },
          ],
        }),
        annotationNames: ["quality.relevance", "quality.style"],
        sourceId: "Span:1",
        createdAt: "2026-09-10T12:00:00Z",
      })
    ).toMatchObject([
      {
        name: "quality.relevance",
        label: "relevant",
        score: 1,
        explanation: "Supported by the context.",
      },
      {
        name: "quality.style",
        label: "clear",
        score: 0.9,
        explanation: "The response is concise.",
      },
    ]);
  });
});
