import { createClient } from "../client";
import { ClientFn } from "../types/core";

import { SessionAnnotation, toSessionAnnotationData } from "./types";

/**
 * Parameters to add a span annotation
 */
export interface AddSessionAnnotationParams extends ClientFn {
  sessionAnnotation: SessionAnnotation;
  /**
   * If true, the request will be fulfilled synchronously and return the annotation ID.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Add an annotation to a session.
 *
 * The annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, and metadata.
 * If an identifier is provided and an annotation with that identifier already exists, it will be updated.
 *
 * @param params - The parameters to add a span annotation
 * @returns The ID of the created or updated annotation
 *
 * @example
 * ```ts
 * const result = await addSessionAnnotation({
 *   sessionAnnotation: {
 *     sessionId: "123abc",
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
export async function addSessionAnnotation({
  client: _client,
  sessionAnnotation,
  sync = false,
}: AddSessionAnnotationParams): Promise<{ id: string } | null> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/session_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: [toSessionAnnotationData(sessionAnnotation)],
    },
  });

  if (error) {
    throw new Error(`Failed to add session annotation: ${error}`);
  }

  return data?.data?.[0] || null;
}
