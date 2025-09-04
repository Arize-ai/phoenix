import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DocumentAnnotation, toDocumentAnnotationData } from "./types";

/**
 * Parameters to add a document annotation
 */
export interface AddDocumentAnnotationParams extends ClientFn {
  documentAnnotation: DocumentAnnotation;
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
}: AddDocumentAnnotationParams): Promise<{ id: string }> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/span_documents", {
    body: {
      data: [toDocumentAnnotationData(documentAnnotation)],
    },
  });

  if (error) {
    throw new Error(`Failed to add document annotation: ${error}`);
  }

  if (!data?.data?.[0]?.id) {
    throw new Error("No annotation ID returned from server");
  }

  return data.data[0];
}
