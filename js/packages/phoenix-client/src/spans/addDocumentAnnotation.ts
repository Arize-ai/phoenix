import { createClient } from "../client";
import { ClientFn } from "../types/core";

import { DocumentAnnotation, toDocumentAnnotationData } from "./types";

/**
 * Parameters to add a document annotation
 */
export interface AddDocumentAnnotationParams extends ClientFn {
  documentAnnotation: DocumentAnnotation;
  /**
   * If true, the request will be fulfilled synchronously and return the annotation ID.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Add an annotation to a document within a span.
 *
 * The annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, explanation, and metadata.
 * At least one of label, score, or explanation must be provided.
 *
 * @param params - The parameters to add a document annotation
 * @returns The ID of the created annotation
 *
 * @example
 * ```ts
 * const result = await addDocumentAnnotation({
 *   documentAnnotation: {
 *     spanId: "123abc",
 *     documentPosition: 0,
 *     name: "relevance_score",
 *     label: "relevant",
 *     score: 0.95,
 *     annotatorKind: "LLM",
 *     explanation: "Document is highly relevant to the query",
 *     metadata: {
 *       model: "gpt-4"
 *     }
 *   }
 * });
 * ```
 */
export async function addDocumentAnnotation({
  client: _client,
  documentAnnotation,
  sync = false,
}: AddDocumentAnnotationParams): Promise<{ id: string } | null> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/document_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: [toDocumentAnnotationData(documentAnnotation)],
    },
  });

  if (error) {
    throw new Error(`Failed to add document annotation: ${error}`);
  }

  return data?.data?.[0] || null;
}
