import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { SpanAnnotation, toSpanAnnotationData } from "./types";

/**
 * Parameters to add a span annotation
 */
interface AddSpanAnnotationParams extends ClientFn {
  spanAnnotation: SpanAnnotation;
}

/**
 * Add an annotation to a span.
 *
 * The annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, and metadata.
 * If an identifier is provided and an annotation with that identifier already exists, it will be updated.
 *
 * @param params - The parameters to add a span annotation
 * @returns The ID of the created or updated annotation
 *
 * @example
 * ```ts
 * const result = await addSpanAnnotation({
 *   spanAnnotation: {
 *     spanId: "123abc",
 *     name: "quality_score",
 *     label: "good",
 *     score: 0.95,
 *     annotatorKind: "LLM",
 *     identifier: "custom_id_123",
 *     metadata: {
 *       model: "gpt-4"
 *     }
 *   }
 * });
 * ```
 */
export async function addSpanAnnotation({
  client: _client,
  spanAnnotation,
}: AddSpanAnnotationParams): Promise<{ id: string }> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/span_annotations", {
    body: {
      data: [toSpanAnnotationData(spanAnnotation)],
    },
  });

  if (error) {
    throw new Error(`Failed to add span annotation: ${error}`);
  }

  if (!data?.data?.[0]?.id) {
    throw new Error("No annotation ID returned from server");
  }

  return data.data[0];
}
