import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import { traceFilterCoreVocabulary } from "../traceFilterCoreVocabulary.generated";
import {
  getTraceFilterAIFieldName,
  traceFilterAIQueryDSL,
  traceFilterLoopVariables,
  traceFilterSnippets,
} from "../traceFilterDSL";

describe("trace filter AI vocabulary", () => {
  it("qualifies every generated collection field with its named loop variable", () => {
    const fieldNames = new Set(
      traceFilterAIQueryDSL.fields.map(({ name }) => name)
    );

    expect(
      traceFilterCoreVocabulary
        .filter((term): term is typeof term & { iterableName: string } =>
          Boolean(term.iterableName)
        )
        .map((term) => getTraceFilterAIFieldName(term))
        .filter((qualified) => !fieldNames.has(qualified))
    ).toEqual([]);
    expect(
      traceFilterCoreVocabulary
        .filter((term) => term.iterableName)
        .map((term) => getTraceFilterAIFieldName(term))
        .every((name) =>
          Object.values(traceFilterLoopVariables).some((loopVariable) =>
            name.startsWith(`${loopVariable}.`)
          )
        )
    ).toBe(true);
    expect(fieldNames).toContain("attributes['key']");
    expect(fieldNames).not.toContain("attributes[...]");
  });
});

describe("trace filter snippets", () => {
  it("offers text search over both root-span input and output", () => {
    const browsable = traceFilterSnippets.slice(0, MAX_BROWSE_SUGGESTIONS);
    const search = browsable.find(({ snippet }) => snippet.includes("input"));

    expect(search).toBeDefined();
    expect(search?.snippet).toContain("output");
    expect(search?.boost).toBeGreaterThan(0);
  });

  it("expresses direct children through the stored parent relationship", () => {
    const directChild = traceFilterSnippets.find(
      ({ label }) => label === "direct child of the trace root"
    );

    expect(directChild?.snippet).toContain("parent_span is not None");
    expect(directChild?.snippet).toContain("parent_span.parent_id is None");
  });
});
