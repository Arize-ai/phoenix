import type { operations } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { ListDatasetLabelsQuery, ListDatasetLabelsResult } from "./types";

export type ListDatasetLabelsParams = ClientFn & ListDatasetLabelsQuery;

/**
 * List global dataset label resources with cursor-based pagination.
 *
 * These labels are reusable resources. Assigning them to individual datasets
 * uses the dataset-label assignment endpoints, which are separate from this
 * global list.
 *
 * @param params - The pagination and client parameters.
 * @param params.cursor - Cursor returned by the previous page.
 * @param params.limit - Maximum number of labels to return.
 * @param params.client - Optional Phoenix client instance.
 * @returns A page of labels and the cursor for the next page.
 */
export async function listDatasetLabels({
  client: _client,
  cursor,
  limit = 100,
}: ListDatasetLabelsParams = {}): Promise<ListDatasetLabelsResult> {
  const client = _client ?? createClient();
  const query: NonNullable<
    operations["listDatasetLabels"]["parameters"]["query"]
  > = { limit };

  if (cursor) {
    query.cursor = cursor;
  }

  const { data, error } = await client.GET("/v1/dataset_labels", {
    params: { query },
  });

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to list dataset labels");

  return {
    datasetLabels: data.data,
    nextCursor: data.next_cursor,
  };
}
