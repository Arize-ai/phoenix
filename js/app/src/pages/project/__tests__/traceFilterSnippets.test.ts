import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import {
  createTraceFilterAIQueryDSL,
  traceFilterSnippets,
  type TraceFilterVocabularyTerm,
} from "../traceFilterDSL";

const vocabulary: TraceFilterVocabularyTerm[] = [
  {
    name: "attributes[...]",
    type: "string",
    description: "Displayed-root attribute by key.",
    category: "attribute",
  },
  {
    name: "latency_ms",
    type: "number",
    description: "Span latency.",
    category: "element",
    iterableName: "spans",
  },
  {
    name: "score",
    type: "number",
    description: "Trace annotation score.",
    category: "element",
    iterableName: "trace_annotations",
  },
  {
    name: "label",
    type: "string",
    description: "Span annotation label.",
    category: "element",
    iterableName: "span_annotations",
  },
  {
    name: "cost",
    type: "number",
    description: "Span cost detail.",
    category: "element",
    iterableName: "span_cost_details",
  },
];

describe("trace filter AI vocabulary", () => {
  it("maps runtime terms to valid AI field names", () => {
    const fieldNames = createTraceFilterAIQueryDSL(vocabulary).fields.map(
      ({ name }) => name
    );

    expect(fieldNames).toEqual([
      "attributes['key']",
      "span.latency_ms",
      "annotation.score",
      "annotation.label",
      "cost_detail.cost",
    ]);
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
