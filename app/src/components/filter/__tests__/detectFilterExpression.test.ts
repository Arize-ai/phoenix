import { describe, expect, it } from "vitest";

import { looksLikeDSLExpression } from "../ai/detectFilterExpression";

describe("looksLikeDSLExpression", () => {
  it("recognizes DSL syntax", () => {
    expect(looksLikeDSLExpression("span_kind == 'LLM'")).toBe(true);
    expect(looksLikeDSLExpression("latency_ms > 1000")).toBe(true);
    expect(looksLikeDSLExpression("'error' in output.value")).toBe(true);
    expect(looksLikeDSLExpression('"error" in output.value')).toBe(true);
    expect(looksLikeDSLExpression("attributes['llm']['provider']")).toBe(true);
    expect(looksLikeDSLExpression("parent_id is None")).toBe(true);
    expect(looksLikeDSLExpression("metadata['key'] is not None")).toBe(true);
  });

  it("treats plain language as plain language", () => {
    expect(looksLikeDSLExpression("llm spans that errored")).toBe(false);
    expect(looksLikeDSLExpression("slow spans")).toBe(false);
  });

  it("does not mistake apostrophes for a string literal", () => {
    // Two contractions in one sentence produce a pair of apostrophes; they
    // are not a quoted literal, and reading them as one would withhold the
    // AI affordance and flag the field invalid instead
    expect(
      looksLikeDSLExpression("spans that didn't error and weren't retried")
    ).toBe(false);
    expect(
      looksLikeDSLExpression("spans where the user's request wasn't answered")
    ).toBe(false);
  });
});
