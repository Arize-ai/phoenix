import { describe, expect, it } from "vitest";

import { createAnnotationMemberCompletions } from "../annotationCompletions";

describe("createAnnotationMemberCompletions", () => {
  it("expands each name into label, score, and explanation members", () => {
    const completions = createAnnotationMemberCompletions({
      accessor: "evals",
      noun: "evaluation",
      sectionName: "Evaluations",
      names: ["Hallucination"],
    });
    expect(completions.map((completion) => completion.label)).toEqual([
      "evals['Hallucination'].label",
      "evals['Hallucination'].score",
      "evals['Hallucination'].explanation",
    ]);
  });

  it("adds an identifier member when the backing DSL supports it", () => {
    const completions = createAnnotationMemberCompletions({
      accessor: "annotations",
      noun: "annotation",
      sectionName: "Annotations",
      names: ["note"],
      includeIdentifier: true,
    });
    expect(completions.map((completion) => completion.label)).toEqual([
      "annotations['note'].label",
      "annotations['note'].score",
      "annotations['note'].explanation",
      "annotations['note'].identifier",
    ]);
  });
});
