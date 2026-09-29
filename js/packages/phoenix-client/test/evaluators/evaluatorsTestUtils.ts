import type {
  CodeEvaluatorDefinition,
  CodeEvaluatorVersion,
  LLMEvaluatorDefinition,
} from "../../src/types/evaluators";

export const CODE_EVALUATOR_ID = "Q29kZUV2YWx1YXRvcjoy";
export const LLM_EVALUATOR_ID = "TExNRXZhbHVhdG9yOjE=";
export const VERSION_ID = "Q29kZUV2YWx1YXRvclZlcnNpb246MQ==";

export const llmDefinition: LLMEvaluatorDefinition = {
  type: "llm",
  id: LLM_EVALUATOR_ID,
  name: "toxicity",
  description: "toxicity",
  prompt_id: "UHJvbXB0OjE=",
  prompt_version: null,
  output_configs: [
    {
      type: "CATEGORICAL",
      name: "toxicity",
      optimization_direction: "MINIMIZE",
      values: [
        { label: "toxic", score: 1 },
        { label: "clean", score: 0 },
      ],
    },
  ],
};

export const codeDefinition: CodeEvaluatorDefinition = {
  type: "code",
  id: CODE_EVALUATOR_ID,
  name: "exact-match",
  description: null,
  language: "PYTHON",
  sandbox_config_id: "U2FuZGJveENvbmZpZzox",
  input_mapping: { literal_mapping: {}, path_mapping: { output: "output" } },
  output_configs: [
    { type: "CONTINUOUS", name: "score", optimization_direction: "MAXIMIZE" },
  ],
  current_version_id: VERSION_ID,
  source_code: "def evaluate(output: str) -> float:\n    return 1.0\n",
};

export const codeVersion: CodeEvaluatorVersion = {
  id: VERSION_ID,
  evaluator_id: CODE_EVALUATOR_ID,
  source_code: "def evaluate(output: str) -> float:\n    return 0.0\n",
  created_at: "2026-01-01T00:00:00+00:00",
};
