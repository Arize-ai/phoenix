import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

export type LLMEvaluatorTemplate = Readonly<{
  systemPrompt: string;
  userPrompt: string;
  outputConfigs: readonly ClassificationEvaluatorAnnotationConfig[];
}>;
