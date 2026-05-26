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
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.name).toBe("hallucination-check");
    expect(input.sourceCode).toBe("def evaluate(output):\n    return 1.0");
    expect(input.language).toBe("PYTHON");
    expect(input.sandboxConfigId).toBe("U2FuZGJveENvbmZpZzox");
    expect(input.inputMapping).toEqual({
      pathMapping: {},
      literalMapping: {},
    });
    expect(input.outputConfigs).toEqual([]);
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
      sandboxConfigId: "U2FuZGJveENvbmZpZzox",
    });
    expect(parsed).toBeNull();
  });

  it("rejects missing sandbox_config_id", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "foo",
      sourceCode: "def evaluate(output): return 1",
      language: "PYTHON",
    });
    expect(parsed).toBeNull();
  });

  it("rejects missing required fields", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "foo",
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
    });
    expect(parsed).toBeNull();
  });

  it("defaults outputConfigs to an empty array when omitted", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "no-output-config",
      source_code: "def evaluate(output):\n    return 1.0",
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfigs).toEqual([]);
  });

  it("parses a fully specified freeform output_config draft", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "score-quality",
      source_code: "def evaluate(output):\n    return 0.5",
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
      output_configs: [
        {
          kind: "freeform",
          name: "score-quality",
          optimizationDirection: "MAXIMIZE",
          threshold: 0.7,
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfigs).toHaveLength(1);
    expect(input.outputConfigs[0]).toEqual({
      kind: "freeform",
      name: "score-quality",
      optimizationDirection: "MAXIMIZE",
      threshold: 0.7,
      lowerBound: 0,
      upperBound: 1,
    });
  });

  it("parses a classification output_config draft with values", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "label",
      sourceCode: "def evaluate(output): return 'a'",
      language: "PYTHON",
      sandboxConfigId: "U2FuZGJveENvbmZpZzox",
      outputConfigs: [
        {
          kind: "classification",
          name: "label",
          optimizationDirection: "NONE",
          values: [
            { label: "good", score: 1 },
            { label: "bad" },
          ],
        },
      ],
    });
    expect(parsed).not.toBeNull();
    const input = parsed as CreateCodeEvaluatorInput;
    expect(input.outputConfigs[0]).toMatchObject({
      kind: "classification",
      values: [
        { label: "good", score: 1 },
        { label: "bad" },
      ],
    });
  });

  it("rejects an invalid optimization direction in an output_configs entry", () => {
    const parsed = parseCreateCodeEvaluatorInput({
      name: "score-bad-direction",
      source_code: "def evaluate(output):\n    return 0.0",
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
      output_configs: [
        {
          kind: "freeform",
          name: "score-bad-direction",
          optimization_direction: "SIDEWAYS",
        },
      ],
    });
    expect(parsed).toBeNull();
  });
});
