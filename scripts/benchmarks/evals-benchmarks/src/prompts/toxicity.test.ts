import { describe, expect, it } from "vitest";

import { resolveToxicityPromptTemplate } from "./toxicity.js";

describe("resolveToxicityPromptTemplate", () => {
  it("leaves the library template in place for default", () => {
    expect(resolveToxicityPromptTemplate("default")).toBeUndefined();
  });

  it("returns a few-shot message template that still interpolates text", () => {
    const promptTemplate = resolveToxicityPromptTemplate("few-shot");
    expect(Array.isArray(promptTemplate)).toBe(true);
    const content = Array.isArray(promptTemplate)
      ? promptTemplate[0]?.content
      : undefined;
    expect(typeof content).toBe("string");
    expect(content).toContain("{{text}}");
    expect(content).toContain("<examples>");
    expect(content).toContain("Label: toxic");
    expect(content).toContain("Label: non-toxic");
  });

  it("throws on unknown techniques", () => {
    expect(() => resolveToxicityPromptTemplate("cot")).toThrow(
      /Unknown toxicity prompt technique/
    );
  });
});
