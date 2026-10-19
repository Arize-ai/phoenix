import { describe, expect, it } from "vitest";

import { resolvePromptTemplate } from "./index.js";

describe("resolvePromptTemplate", () => {
  it("delegates toxicity techniques to the toxicity module", () => {
    expect(
      resolvePromptTemplate({
        evaluator: "toxicity",
        promptTechnique: "default",
      })
    ).toBeUndefined();
    const fewShot = resolvePromptTemplate({
      evaluator: "toxicity",
      promptTechnique: "few-shot",
    });
    expect(Array.isArray(fewShot)).toBe(true);
  });

  it("leaves the library template in place for other evaluators on default", () => {
    expect(
      resolvePromptTemplate({
        evaluator: "hallucination",
        promptTechnique: "default",
      })
    ).toBeUndefined();
  });

  it("throws when an unregistered technique is requested", () => {
    expect(() =>
      resolvePromptTemplate({
        evaluator: "hallucination",
        promptTechnique: "few-shot",
      })
    ).toThrow(/Unknown prompt technique/);
  });
});
