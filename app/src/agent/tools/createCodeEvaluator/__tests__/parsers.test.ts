import {
  parseCreateCodeEvaluatorInput,
  type CreateCodeEvaluatorInput,
} from "@phoenix/agent/tools/createCodeEvaluator";

describe("parseCreateCodeEvaluatorInput", () => {
  it("accepts snake_case keys and applies the default input_mapping", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "hallucination-check",
      source_code: "def evaluate(output):\n    return 1.0",
      language: "PYTHON",
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.name).toBe("hallucination-check");
    expect(input.sourceCode).toBe("def evaluate(output):\n    return 1.0");
    expect(input.language).toBe("PYTHON");
    expect(input.inputMapping).toEqual({
      pathMapping: {},
      literalMapping: {},
    });
    expect(input.sandboxConfigId).toBeNull();
  });

  it("preserves camelCase keys and a provided input_mapping", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "json-validity",
      sourceCode:
        "function evaluate({ output }) { return { score: output ? 1 : 0 }; }",
      language: "TYPESCRIPT",
      sandboxConfigId: "U2FuZGJveENvbmZpZzox",
      inputMapping: {
        pathMapping: { output: "attributes.output.value" },
        literalMapping: { threshold: 0.5 },
      },
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.language).toBe("TYPESCRIPT");
    expect(input.sandboxConfigId).toBe("U2FuZGJveENvbmZpZzox");
    expect(input.inputMapping.pathMapping).toEqual({
      output: "attributes.output.value",
    });
    expect(input.inputMapping.literalMapping).toEqual({ threshold: 0.5 });
  });

  it("rejects an invalid language", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "foo",
      sourceCode: "def evaluate(output): return 1",
      language: "RUBY",
    });
    expect(parsed).toBeNull();
  });

  it("rejects missing required fields", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "foo",
      language: "PYTHON",
    });
    expect(parsed).toBeNull();
  });

  it("defaults outputConfig to null when omitted", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "no-output-config",
      source_code: "def evaluate(output):\n    return 1.0",
      language: "PYTHON",
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfig).toBeNull();
  });

  it("parses a fully specified freeform output_config with snake_case aliases", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "score-quality",
      source_code: "def evaluate(output):\n    return 0.5",
      language: "PYTHON",
      output_config: {
        optimization_direction: "MAXIMIZE",
        threshold: 0.7,
        lower_bound: 0,
        upper_bound: 1,
      },
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfig).toEqual({
      optimizationDirection: "MAXIMIZE",
      threshold: 0.7,
      lowerBound: 0,
      upperBound: 1,
    });
  });

  it("parses a partial freeform output_config with camelCase keys", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "score-partial",
      sourceCode: "def evaluate(output):\n    return 0.0",
      language: "PYTHON",
      outputConfig: {
        optimizationDirection: "NONE",
      },
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfig).not.toBeNull();
    expect(input.outputConfig?.optimizationDirection).toBe("NONE");
    // Unset numeric fields normalize to null (no defaults injected).
    expect(input.outputConfig?.threshold ?? null).toBeNull();
    expect(input.outputConfig?.lowerBound ?? null).toBeNull();
    expect(input.outputConfig?.upperBound ?? null).toBeNull();
  });

  it("rejects an invalid optimization_direction inside output_config", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "score-bad-direction",
      source_code: "def evaluate(output):\n    return 0.0",
      language: "PYTHON",
      output_config: {
        optimization_direction: "SIDEWAYS",
      },
    });
    expect(parsed).toBeNull();
  });
});
