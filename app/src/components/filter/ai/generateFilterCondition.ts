import type { LanguageModel, ModelMessage } from "ai";
import { streamText } from "ai";

import type { DSLFilterConditionValidationResult } from "../DSLFilterConditionField";
import {
  buildAIQueryRepairPrompt,
  buildAIQuerySystemPrompt,
} from "./buildAIQueryPrompt";
import {
  extractFilterExpression,
  extractStreamedFilterExpression,
} from "./extractFilterExpression";
import type { AIQueryDSL } from "./types";

export type GenerateFilterConditionArgs<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = {
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
  ) => Promise<TValidationResult | null | undefined>;
  abortSignal?: AbortSignal;
};

/**
 * The floor between streamed preview emissions. Tokens can arrive at 30-60
 * per second; nobody reads that fast, and each emission re-renders the
 * consumer's filter state.
 */
const DELTA_EMIT_INTERVAL_MS = 50;

export type GenerateFilterConditionResult<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = {
  expression: string;
  /**
   * The validator's passing verdict for exactly this expression, when the
   * validator was consulted and accepted it — so the caller can apply the
   * expression without asking the validator the same question again. `null`
   * when no validator ran for this expression (none provided, the validator
   * abstained, or the expression is an unchecked repair round).
   */
  validation: TValidationResult | null;
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
  let lastDeltaEmitTime = 0;
  // Consume the full stream, not just the text: the SDK reports stream
  // failures and aborts as parts rather than throwing, and dropping them
  // would pass off whatever text arrived before the break as the model's
  // finished answer.
  for await (const part of result.fullStream) {
    if (part.type === "error") {
      throw part.error instanceof Error
        ? part.error
        : new Error(String(part.error));
    }
    if (part.type === "abort") {
      throw new DOMException("The conversion was cancelled", "AbortError");
    }
    if (part.type !== "text-delta") {
      continue;
    }
    text += part.text;
    // Null until the answer has begun — reasoning never reaches the field.
    // Emissions are coalesced: tokens arrive faster than anyone reads, and
    // each one re-renders the consumer's filter state. The final expression
    // is not throttled; it resolves through the return value below.
    const partial = extractStreamedFilterExpression(text);
    const now = Date.now();
    if (partial && now - lastDeltaEmitTime >= DELTA_EMIT_INTERVAL_MS) {
      lastDeltaEmitTime = now;
      onDelta?.(partial);
    }
  }
  return extractFilterExpression(text);
}

/**
 * Translates a natural-language request into a filter expression via a
 * single streaming completion, with one self-correction round when a
 * validator rejects the result. Resolves to the final expression plus the
 * validator's verdict when one was obtained; the caller owns what happens
 * to it (typically it flows into the field's normal validate-then-apply
 * pipeline, exactly as if the user had typed it — skipping the redundant
 * revalidation when the verdict is already in hand).
 */
export async function generateFilterCondition<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
>({
  model,
  dsl,
  query,
  onDelta,
  validate,
  abortSignal,
}: GenerateFilterConditionArgs<TValidationResult>): Promise<
  GenerateFilterConditionResult<TValidationResult>
> {
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
    return { expression, validation: null };
  }
  let validation: TValidationResult | null | undefined;
  try {
    validation = await validate(expression);
  } catch {
    // The validator could not answer (e.g. a transport failure) — that is
    // not a generation failure, and the expression is already complete.
    // Hand it back with no verdict: the field's own validation pipeline
    // will ask again and surface a persistent transport problem as a
    // retryable validation error instead of discarding the model's work.
    return { expression, validation: null };
  }
  if (validation == null) {
    return { expression, validation: null };
  }
  if (validation.isValid) {
    return { expression, validation };
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
  // The repair round is not revalidated here — the caller's normal
  // validation pipeline is the arbiter of whether the correction landed
  return { expression: repaired, validation: null };
}
