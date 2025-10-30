import { createClient } from "../client";
import { ClientFn } from "../types/core";

import { DocumentAnnotation, toDocumentAnnotationData } from "./types";

/**
 * Parameters to log multiple document annotations
 */
export interface LogDocumentAnnotationsParams extends ClientFn {
  /**
   * The document annotations to log
   */
  documentAnnotations: DocumentAnnotation[];
  /**
   * If true, the request will be fulfilled synchronously and return the annotation IDs.
   * If false, the request will be processed asynchronously and return null.
   * @default false
   */
  sync?: boolean;
}

/**
 * Log multiple document annotations in a single request.
 *
 * Each annotation can be of type "LLM", "CODE", or "HUMAN" and can include a label, score, explanation, and metadata.
 * At least one of label, score, or explanation must be provided for each annotation.
 *
 * @param params - The parameters to log document annotations
 * @returns The IDs of the created annotations
 *
 * @example
 * ```ts
 * const results = await logDocumentAnnotations({
 *   documentAnnotations: [
 *     {
 *       spanId: "123abc",
 *       documentPosition: 0,
 *       name: "relevance_score",
 *       label: "relevant",
 *       score: 0.95,
 *       annotatorKind: "LLM",
 *       explanation: "Document is highly relevant to the query",
 *       metadata: {
 *         model: "gpt-4"
 *       }
 *     },
 *     {
 *       spanId: "123abc",
 *       documentPosition: 1,
 *       name: "relevance_score",
 *       label: "somewhat_relevant",
 *       score: 0.6,
 *       annotatorKind: "LLM"
 *     }
 *   ]
 * });
 * ```
 */
export async function logDocumentAnnotations({
  client: _client,
  documentAnnotations,
  sync = false,
}: LogDocumentAnnotationsParams): Promise<{ id: string }[]> {
  const client = _client ?? createClient();

  const { data, error } = await client.POST("/v1/document_annotations", {
    params: {
      query: { sync },
    },
    body: {
      data: documentAnnotations.map(toDocumentAnnotationData),
    },
  });

  if (error) {
    throw new Error(`Failed to log document annotations: ${error}`);
  }

  return data?.data || [];
}
