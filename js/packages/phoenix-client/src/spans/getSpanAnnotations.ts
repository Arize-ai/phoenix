import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { operations } from "../__generated__/api/v1";
import { ProjectSelector } from "../types/projects";

/**
 * Parameters to get span annotations from a project using auto-generated types
 */
export interface GetSpanAnnotationsParams extends ClientFn {
  /** The project to get span annotations from */
  project: ProjectSelector;
  /** One or more span IDs to fetch annotations for */
  spanIds: string[];
  /** Optional list of annotation names to include. If provided, only annotations with these names will be returned. 'note' annotations are excluded by default unless explicitly included in this list. */
  includeAnnotationNames?: string[];
  /** Optional list of annotation names to exclude from results. */
  excludeAnnotationNames?: string[];
  /** Pagination cursor */
  cursor?: string | null;
  /** Maximum number of annotations to return */
  limit?: number;
}

export type GetSpanAnnotationsResponse =
  operations["listSpanAnnotationsBySpanIds"]["responses"]["200"];

export type GetSpanAnnotationsResult = {
  annotations: GetSpanAnnotationsResponse["content"]["application/json"]["data"];
  nextCursor: GetSpanAnnotationsResponse["content"]["application/json"]["next_cursor"];
};

/**
 * Get span annotations for a list of span IDs.
 *
 * This method allows you to retrieve annotations for specific spans within a project.
 * You can filter annotations by name and support cursor-based pagination.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to get span annotations
 * @returns A paginated response containing annotations and optional next cursor
 *
 * @example
 * ```ts
 * // Get annotations for specific spans
 * const result = await getSpanAnnotations({
 *   client,
 *   project: { projectName: "my-project" },
 *   spanIds: ["span1", "span2", "span3"],
 *   limit: 50
 * });
 *
 * // Get specific annotation types
 * const result = await getSpanAnnotations({
 *   client,
 *   project: { projectName: "my-project" },
 *   spanIds: ["span1"],
 *   includeAnnotationNames: ["quality_score", "sentiment"],
 *   limit: 100
 * });
 *
 * // Paginate through results
 * let cursor: string | undefined;
 * do {
 *   const result = await getSpanAnnotations({
 *     client,
 *     project: { projectName: "my-project" },
 *     spanIds: ["span1"],
 *     cursor,
 *     limit: 100
 *   });
 *
 *   // Process annotations
 *   result.annotations.forEach(annotation => {
 *     console.log(`Annotation: ${annotation.name}, Label: ${annotation.result.label}`);
 *   });
 *
 *   cursor = result.nextCursor || undefined;
 * } while (cursor);
 * ```
 */
export async function getSpanAnnotations({
  client: _client,
  project,
  spanIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  cursor,
  limit = 100,
}: GetSpanAnnotationsParams): Promise<GetSpanAnnotationsResult> {
  const client = _client ?? createClient();
  const projectIdentifier =
    "projectId" in project ? project.projectId : project.projectName;

  const params: NonNullable<
    operations["listSpanAnnotationsBySpanIds"]["parameters"]["query"]
  > = {
    span_ids: spanIds,
    limit,
  };

  if (cursor) {
    params.cursor = cursor;
  }

  if (includeAnnotationNames !== undefined) {
    params.include_annotation_names = includeAnnotationNames;
  }

  if (excludeAnnotationNames !== undefined) {
    params.exclude_annotation_names = excludeAnnotationNames;
  }

  const { data, error } = await client.GET(
    "/v1/projects/{project_identifier}/span_annotations",
    {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
        query: params,
      },
    }
  );

  if (error) throw error;
  return {
    annotations: data?.data ?? [],
    nextCursor: data?.next_cursor ?? null,
  };
}
