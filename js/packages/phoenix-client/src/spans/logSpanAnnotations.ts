import { createClient } from "../client";
import { ClientFn } from "../types/core";

import { SpanAnnotation, toSpanAnnotationData } from "./types";

/**
 * Parameters to log multiple span annotations
 */
export interface LogSpanAnnotationsParams extends ClientFn {
  /**
   * The span annotations to log
   */
  spanAnnotations: SpanAnnotation[];
  /**
   * If true, the request will be fulfilled synchronously and return the annotation IDs.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Log multiple span annotations in a single request.
 *
 * Each annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, and metadata.
 * If an identifier is provided and an annotation with that identifier already exists, it will be updated.
 *
 * @param params - The parameters to log span annotations
 * @returns The IDs of the created or updated annotations
 *
 * @example
 * ```ts
 * const results = await logSpanAnnotations({
 *   spanAnnotations: [
 *     {
 *       spanId: "123abc",
 *       name: "quality_score",
 *       label: "good",
 *       score: 0.95,
 *       annotatorKind: "LLM",
 *       identifier: "custom_id_123",
 *       metadata: {
 *         model: "gpt-4"
 *       }
 *     },
 *     {
 *       spanId: "456def",
 *       name: "sentiment",
 *       label: "positive",
 *       score: 0.8,
 *       annotatorKind: "CODE"
 *     }
 *   ]
 * });
 * ```
 */
export async function logSpanAnnotations({
  client: _client,
  spanAnnotations,
  sync = false,
}: LogSpanAnnotationsParams): Promise<{ id: string }[]> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/span_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: spanAnnotations.map(toSpanAnnotationData),
    },
  });

  if (error) {
    throw new Error(`Failed to log span annotations: ${error}`);
  }

  return data?.data || [];
}
