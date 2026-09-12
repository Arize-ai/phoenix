import { describe, expect, it } from "vitest";

import {
  applySpanAnnotationWrites,
  createSpanSampleRow,
  planSpanAnnotationWrites,
} from "../evaluatorPlaygroundSpanRows";
import type { SampleExample } from "../evaluatorResults";

const span = {
  id: "span-1",
  name: "ChatCompletion",
  evaluationContext: {
    input: { messages: [] },
    output: "hi",
    metadata: { span_kind: "LLM", attributes: {}, annotations: {} },
  },
  spanAnnotations: [
    {
      id: "ann-human",
      name: "correctness",
      annotatorKind: "HUMAN",
      label: "correct",
      score: 1,
      explanation: null,
    },
    {
      id: "ann-llm",
      name: "correctness",
      annotatorKind: "LLM",
      label: "incorrect",
      score: 0,
      explanation: "judge",
    },
  ],
};

describe("createSpanSampleRow", () => {
  it("reads the evaluation context and keeps only HUMAN annotations", () => {
    const row = createSpanSampleRow(span);
    expect(row).toMatchObject({
      id: "span-1",
      revisionId: "span-1",
      name: "ChatCompletion",
      input: { messages: [] },
      output: "hi",
    });
    expect(row.calibrationLabels).toEqual([
      {
        annotationId: "ann-human",
        annotationName: "correctness",
        label: "correct",
        score: 1,
        explanation: null,
      },
    ]);
  });

  it("tolerates a context that is not an object", () => {
    expect(
      createSpanSampleRow({ ...span, evaluationContext: null })
    ).toMatchObject({
      input: undefined,
      output: undefined,
      metadata: undefined,
    });
  });
});

const rows: SampleExample[] = [
  createSpanSampleRow(span),
  createSpanSampleRow({ ...span, id: "span-2", spanAnnotations: [] }),
];

describe("planSpanAnnotationWrites", () => {
  it("patches an existing annotation, creates a missing one, and deletes on clear", () => {
    const result = planSpanAnnotationWrites(
      {
        "span-1": {
          correctness: { label: "incorrect", score: 0 },
          tone: null,
        },
        "span-2": { correctness: { label: "correct" } },
      },
      rows
    );
    expect(result).toEqual({
      ok: true,
      plan: {
        patches: [
          {
            annotationId: "ann-human",
            label: "incorrect",
            score: 0,
            explanation: null,
          },
        ],
        creates: [
          {
            spanId: "span-2",
            name: "correctness",
            label: "correct",
            score: null,
            explanation: null,
          },
        ],
        deleteIds: [],
      },
    });
  });

  it("deletes a persisted annotation on clear and ignores clearing nothing", () => {
    expect(
      planSpanAnnotationWrites(
        { "span-1": { correctness: null }, "span-2": { correctness: null } },
        rows
      )
    ).toEqual({
      ok: true,
      plan: { creates: [], patches: [], deleteIds: ["ann-human"] },
    });
  });

  it("fails the batch when a span has left the sample", () => {
    expect(
      planSpanAnnotationWrites({ gone: { correctness: { label: "x" } } }, rows)
    ).toMatchObject({ ok: false });
  });
});

describe("applySpanAnnotationWrites", () => {
  it("replaces patched annotations, adds created ones, and drops deleted ones", () => {
    const next = applySpanAnnotationWrites(rows, {
      saved: [
        {
          id: "ann-human",
          spanId: "span-1",
          name: "correctness",
          label: "incorrect",
          score: 0,
          explanation: null,
        },
        {
          id: "ann-new",
          spanId: "span-2",
          name: "correctness",
          label: "correct",
          score: null,
          explanation: null,
        },
      ],
      deleteIds: [],
    });
    expect(next[0].calibrationLabels).toEqual([
      {
        annotationId: "ann-human",
        annotationName: "correctness",
        label: "incorrect",
        score: 0,
        explanation: null,
      },
    ]);
    expect(next[1].calibrationLabels).toEqual([
      {
        annotationId: "ann-new",
        annotationName: "correctness",
        label: "correct",
        score: null,
        explanation: null,
      },
    ]);
    const cleared = applySpanAnnotationWrites(rows, {
      saved: [],
      deleteIds: ["ann-human"],
    });
    expect(cleared[0].calibrationLabels).toEqual([]);
    // Untouched rows keep their identity.
    expect(cleared[1]).toBe(rows[1]);
  });
});
