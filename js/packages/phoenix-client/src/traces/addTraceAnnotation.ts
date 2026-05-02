import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { TraceAnnotation } from "./types";
import { toTraceAnnotationData } from "./types";

/**
 * Parameters to add a trace annotation
 */
export interface AddTraceAnnotationParams extends ClientFn {
  traceAnnotation: TraceAnnotation;
  /**
   * If true, the request will be fulfilled synchronously and return the annotation ID.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Add an annotation to a trace.
 *
 * The annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, and metadata.
 * If an identifier is provided and an annotation with that identifier already exists, it will be updated.
 *
 * @param params - The parameters to add a trace annotation
 * @returns The ID of the created or updated annotation
 *
 * @example
 * ```ts
 * const result = await addTraceAnnotation({
 *   traceAnnotation: {
 *     traceId: "abc123",
 *     name: "correctness",
 *     label: "correct",
 *     score: 1.0,
 *     annotatorKind: "HUMAN",
 *     identifier: "custom_id_123",
 *     metadata: { reviewer: "alice" }
 *   },
 *   sync: true,
 * });
 * ```
 */
export async function addTraceAnnotation({
  client: _client,
  traceAnnotation,
  sync = false,
}: AddTraceAnnotationParams): Promise<{ id: string } | null> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/trace_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: [toTraceAnnotationData(traceAnnotation)],
    },
  });

  if (error) {
    throw new Error(`Failed to add trace annotation: ${error}`);
  }

  return data?.data?.[0] || null;
}
