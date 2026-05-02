import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { TraceAnnotation } from "./types";
import { toTraceAnnotationData } from "./types";

/**
 * Parameters to log multiple trace annotations
 */
export interface LogTraceAnnotationsParams extends ClientFn {
  /**
   * The trace annotations to log
   */
  traceAnnotations: TraceAnnotation[];
  /**
   * If true, the request will be fulfilled synchronously and return the annotation IDs.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Log multiple trace annotations in a single request.
 *
 * Each annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, and metadata.
 * If an identifier is provided and an annotation with that identifier already exists, it will be updated.
 *
 * @param params - The parameters to log trace annotations
 * @returns The IDs of the created or updated annotations
 *
 * @example
 * ```ts
 * const results = await logTraceAnnotations({
 *   traceAnnotations: [
 *     {
 *       traceId: "abc123",
 *       name: "correctness",
 *       label: "correct",
 *       score: 1.0,
 *       annotatorKind: "HUMAN",
 *     },
 *     {
 *       traceId: "def456",
 *       name: "faithfulness",
 *       label: "faithful",
 *       score: 0.9,
 *       annotatorKind: "LLM",
 *     },
 *   ],
 *   sync: true,
 * });
 * ```
 */
export async function logTraceAnnotations({
  client: _client,
  traceAnnotations,
  sync = false,
}: LogTraceAnnotationsParams): Promise<{ id: string }[]> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/trace_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: traceAnnotations.map(toTraceAnnotationData),
    },
  });

  if (error) {
    throw new Error(`Failed to log trace annotations: ${error}`);
  }

  return data?.data || [];
}
