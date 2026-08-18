import { z } from "zod";

import { ANNOTATOR_KINDS } from "@phoenix/constants";
import { isGlobalIdOfType } from "@phoenix/utils/globalIdUtils";

const OTEL_SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;
const OTEL_TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;

const TARGET_KEYS = [
  "spanId",
  "spanNodeId",
  "traceId",
  "traceNodeId",
  "sessionId",
  "sessionNodeId",
] as const;

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

const traceIdSchema = z
  .string()
  .trim()
  .regex(
    OTEL_TRACE_ID_PATTERN,
    "traceId must be a 32-character OpenTelemetry trace ID."
  )
  .transform((traceId) => traceId.toLowerCase());

const traceNodeIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => isGlobalIdOfType(value, "Trace"),
    "traceNodeId must be a valid Trace GraphQL node ID."
  );

const sessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !isGlobalIdOfType(value, "ProjectSession"),
    "Use sessionNodeId for GraphQL session node IDs."
  );

const sessionNodeIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => isGlobalIdOfType(value, "ProjectSession"),
    "sessionNodeId must be a valid ProjectSession GraphQL node ID."
  );

const annotationNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (name) => name !== "note",
    "The annotation name 'note' is reserved for notes."
  );

const nullableTrimmedStringSchema = z
  .preprocess(getTrimmedStringOrNull, z.string().nullable().optional())
  .transform((value) => value ?? null);

const annotationFieldsSchema = z.object({
  spanId: spanIdSchema.optional(),
  spanNodeId: spanNodeIdSchema.optional(),
  traceId: traceIdSchema.optional(),
  traceNodeId: traceNodeIdSchema.optional(),
  sessionId: sessionIdSchema.optional(),
  sessionNodeId: sessionNodeIdSchema.optional(),
  name: annotationNameSchema,
  annotatorKind: z.enum(ANNOTATOR_KINDS).optional(),
  label: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  explanation: z.string().nullable().optional(),
  identifier: nullableTrimmedStringSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * Input for `annotate`: one structured annotation on a span, trace, or session.
 */
export const annotateInputSchema = annotationFieldsSchema
  .strict()
  .superRefine((input, context) => {
    const targets = TARGET_KEYS.filter((key) => Boolean(input[key]));
    if (targets.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide exactly one of spanId, spanNodeId, traceId, traceNodeId, sessionId, or sessionNodeId.",
      });
    }
    if (
      input.label == null &&
      input.score == null &&
      input.explanation == null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Annotation requires at least one of label, score, or explanation.",
      });
    }
  })
  .transform((input) => {
    const base = {
      name: input.name,
      annotatorKind: input.annotatorKind ?? "LLM",
      label: input.label ?? null,
      score: input.score ?? null,
      explanation: input.explanation ?? null,
      identifier: input.identifier,
      metadata: input.metadata ?? null,
    };
    if (input.spanId) {
      return { ...base, target: "span" as const, spanId: input.spanId };
    }
    if (input.spanNodeId) {
      return {
        ...base,
        target: "span" as const,
        spanNodeId: input.spanNodeId,
      };
    }
    if (input.traceId) {
      return { ...base, target: "trace" as const, traceId: input.traceId };
    }
    if (input.traceNodeId) {
      return {
        ...base,
        target: "trace" as const,
        traceNodeId: input.traceNodeId,
      };
    }
    if (input.sessionId) {
      return {
        ...base,
        target: "session" as const,
        sessionId: input.sessionId,
      };
    }
    return {
      ...base,
      target: "session" as const,
      sessionNodeId: input.sessionNodeId as string,
    };
  });
