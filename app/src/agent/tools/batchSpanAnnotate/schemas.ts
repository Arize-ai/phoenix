import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { ANNOTATOR_KINDS } from "@phoenix/constants";
import { isGlobalIdOfType } from "@phoenix/utils/globalIdUtils";

export type BatchSpanAnnotateToolOutputSender =
  Chat<UIMessage>["addToolOutput"];

const OTEL_SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;

function getTrimmedStringOrNull(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const spanIdSchema = z
  .string()
  .trim()
  .regex(
    OTEL_SPAN_ID_PATTERN,
    "spanId must be a 16-character OpenTelemetry span ID."
  )
  .transform((spanId) => spanId.toLowerCase());

const spanNodeIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => isGlobalIdOfType(value, "Span"),
    "spanNodeId must be a valid Span GraphQL node ID."
  );

const annotationNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (name) => name !== "note",
    "The annotation name 'note' is reserved for span notes."
  );

const nullableTrimmedStringSchema = z
  .preprocess(getTrimmedStringOrNull, z.string().nullable().optional())
  .transform((value) => value ?? null);

export const annotateSpanInputSchema = z
  .object({
    spanId: spanIdSchema.optional(),
    spanNodeId: spanNodeIdSchema.optional(),
    name: annotationNameSchema,
    annotatorKind: z.enum(ANNOTATOR_KINDS).optional(),
    label: z.string().nullable().optional(),
    score: z.number().nullable().optional(),
    explanation: z.string().nullable().optional(),
    identifier: nullableTrimmedStringSchema,
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((input) => Boolean(input.spanId) !== Boolean(input.spanNodeId), {
    message: "Provide exactly one of spanId or spanNodeId.",
  })
  .refine(
    (input) =>
      input.label != null || input.score != null || input.explanation != null,
    {
      message:
        "Each annotation requires at least one of label, score, or explanation.",
    }
  )
  .transform((input) => ({
    ...(input.spanId ? { spanId: input.spanId } : {}),
    ...(input.spanNodeId ? { spanNodeId: input.spanNodeId } : {}),
    name: input.name,
    annotatorKind: input.annotatorKind ?? "LLM",
    label: input.label ?? null,
    score: input.score ?? null,
    explanation: input.explanation ?? null,
    identifier: input.identifier,
    metadata: input.metadata ?? null,
  }));

/**
 * Batch input for `batch_span_annotate`: one or more span annotations applied
 * in a single tool call.
 */
export const batchSpanAnnotateInputSchema = z
  .object({ annotations: z.array(annotateSpanInputSchema).min(1) })
  .strict()
  .transform((input) => input.annotations);

export const batchSpanAnnotateActionContextSchema = z
  .object({
    toolCallId: z.string(),
    sessionId: z.string(),
    addToolOutput: z.custom<BatchSpanAnnotateToolOutputSender>(
      (value) => typeof value === "function"
    ),
  })
  .transform((context) => context);
