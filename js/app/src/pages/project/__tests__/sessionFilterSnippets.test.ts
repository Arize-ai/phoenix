import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import {
  createSessionFilterAIQueryDSL,
  sessionFilterSnippets,
  type SessionFilterVocabularyTerm,
} from "../sessionFilterDSL";

const vocabulary: SessionFilterVocabularyTerm[] = [
  {
    name: "latency_ms",
    type: "number",
    description: "Span latency.",
    category: "element",
    iterableName: "spans",
  },
  {
    name: "start_time",
    type: "datetime",
    description: "Trace start time.",
    category: "element",
    iterableName: "traces",
  },
  {
    name: "score",
    type: "number",
    description: "Session annotation score.",
    category: "element",
    iterableName: "session_annotations",
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

describe("session filter loop variables", () => {
  it("qualifies runtime collection fields with the matching loop variable", () => {
    expect(
      createSessionFilterAIQueryDSL(vocabulary).fields.map(({ name }) => name)
    ).toEqual([
      "span.latency_ms",
      "trace.start_time",
      "annotation.score",
      "annotation.label",
      "cost_detail.cost",
    ]);
  });
});

describe("session filter snippets", () => {
  it("offers text search over both input and output in the empty-state dropdown", () => {
    // The retired sessions search field matched either side, so its replacement
    // has to be reachable without typing — and has to search both.
    const browsable = sessionFilterSnippets.slice(0, MAX_BROWSE_SUGGESTIONS);
    const search = browsable.find(({ snippet }) =>
      snippet.includes("any_input")
    );

    expect(search).toBeDefined();
    expect(search?.snippet).toContain("any_output");
    expect(search?.boost).toBeGreaterThan(0);
  });
});
