import type { LanguageModel, ModelMessage } from "ai";
import { streamText } from "ai";

import type { DSLFilterConditionValidationResult } from "../DSLFilterConditionField";
import {
  buildAIQueryRepairPrompt,
  buildAIQuerySystemPrompt,
} from "./buildAIQueryPrompt";
import { extractFilterExpression } from "./extractFilterExpression";
import type { AIQueryDSL } from "./types";

export type GenerateFilterConditionArgs = {
  /**
   * The AI SDK model that performs the translation — the on-device browser
   * model or a configured provider model; the generation path is identical.
   */
  model: LanguageModel;
  /**
   * The DSL to translate into, described by the entity layer.
   */
  dsl: AIQueryDSL;
  /**
   * The user's natural-language request, e.g. "llm spans that errored".
   */
  query: string;
  /**
   * Streams the expression as it is generated so the field can show the
   * translation forming. Always called with the normalized expression so
   * far, never raw model output.
   */
  onDelta?: (partialExpression: string) => void;
  /**
   * When provided, the generated expression is validated and, if rejected,
   * the model gets one round to correct itself with the validator's error.
   */
  validate?: (
    condition: string
  ) => Promise<DSLFilterConditionValidationResult | null | undefined>;
  abortSignal?: AbortSignal;
};

async function streamExpression({
  model,
  system,
  messages,
  onDelta,
  abortSignal,
}: {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  onDelta?: (partialExpression: string) => void;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const result = streamText({ model, system, messages, abortSignal });
  let text = "";
  for await (const delta of result.textStream) {
    text += delta;
    const partial = extractFilterExpression(text);
    if (partial) {
      onDelta?.(partial);
    }
  }
  return extractFilterExpression(text);
}

/**
 * Translates a natural-language request into a filter expression via a
 * single streaming completion, with one self-correction round when a
 * validator rejects the result. Resolves to the final expression; the
 * caller owns what happens to it (typically it flows into the field's
 * normal validate-then-apply pipeline, exactly as if the user had typed it).
 */
export async function generateFilterCondition({
  model,
  dsl,
  query,
  onDelta,
  validate,
  abortSignal,
}: GenerateFilterConditionArgs): Promise<string> {
  const system = buildAIQuerySystemPrompt(dsl);
  const messages: ModelMessage[] = [{ role: "user", content: query }];
  const expression = await streamExpression({
    model,
    system,
    messages,
    onDelta,
    abortSignal,
  });
  if (!expression) {
    throw new Error("The model did not return a filter expression");
  }
  if (!validate) {
    return expression;
  }
  const validation = await validate(expression);
  if (validation == null || validation.isValid) {
    return expression;
  }
  // One repair round: hand the validator's complaint back to the model.
  // More rounds add latency without observed benefit — a model that misses
  // twice tends to keep missing.
  const repaired = await streamExpression({
    model,
    system,
    messages: [
      ...messages,
      { role: "assistant", content: expression },
      {
        role: "user",
        content: buildAIQueryRepairPrompt(validation.errorMessage ?? ""),
      },
    ],
    onDelta,
    abortSignal,
  });
  if (!repaired) {
    throw new Error("The model did not return a filter expression");
  }
  return repaired;
}
