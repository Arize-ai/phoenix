import { describe, expect, it } from "vitest";

import { MAX_BROWSE_SUGGESTIONS } from "@phoenix/components/filter";

import { traceFilterSnippets } from "../TraceFilterConditionField";

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
