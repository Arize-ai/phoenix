import { getVisibleInvocationParameterSpecs } from "..";

describe("visible invocation parameter specs", () => {
  it("hides temperature and top_p only while Anthropic thinking is active", () => {
    expect(
      getVisibleInvocationParameterSpecs(
        { provider: "ANTHROPIC", openaiApiType: null },
        { maxTokens: 2000, thinking: { type: "adaptive" } }
      ).map((spec) => spec.name)
    ).toEqual([
      "maxTokens",
      "stopSequences",
      "thinkingType",
      "thinkingDisplay",
      "effort",
    ]);

    expect(
      getVisibleInvocationParameterSpecs(
        { provider: "ANTHROPIC", openaiApiType: null },
        { maxTokens: 2000, thinking: { type: "disabled" } }
      ).map((spec) => spec.name)
    ).toEqual([
      "maxTokens",
      "temperature",
      "stopSequences",
      "topP",
      "thinkingType",
      "effort",
    ]);
  });

  it("reveals thinkingBudgetTokens only when thinkingType is enabled", () => {
    const visibleWhenEnabled = getVisibleInvocationParameterSpecs(
      { provider: "ANTHROPIC", openaiApiType: null },
      {
        maxTokens: 2000,
        thinking: { type: "enabled", budgetTokens: 1024 },
      }
    ).map((spec) => spec.name);
    expect(visibleWhenEnabled).toContain("thinkingBudgetTokens");

    const visibleWhenAdaptive = getVisibleInvocationParameterSpecs(
      { provider: "ANTHROPIC", openaiApiType: null },
      { maxTokens: 2000, thinking: { type: "adaptive" } }
    ).map((spec) => spec.name);
    expect(visibleWhenAdaptive).not.toContain("thinkingBudgetTokens");
  });

  it("synthesizes a dynamic max on thinkingBudgetTokens from maxTokens", () => {
    const specs = getVisibleInvocationParameterSpecs(
      { provider: "ANTHROPIC", openaiApiType: null },
      {
        maxTokens: 4096,
        thinking: { type: "enabled", budgetTokens: 1024 },
      }
    );
    const budgetSpec = specs.find(
      (spec) => spec.name === "thinkingBudgetTokens"
    );
    expect(budgetSpec).toBeDefined();
    expect(budgetSpec?.type).toBe("int");
    if (budgetSpec?.type === "int") {
      expect(budgetSpec.max).toBe(4095);
    }
  });
});
