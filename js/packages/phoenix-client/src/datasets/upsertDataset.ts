import { createHash } from "node:crypto";
import invariant from "tiny-invariant";

import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { Example } from "../types/datasets";

type UpsertDatasetSelector = { datasetId: string } | { datasetName: string };

type UpsertDatasetRequestSelector = {
  id?: string;
  name?: string;
};

type UpsertDatasetRequestExample = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  splits: string[];
  span_id: string | null;
  content_hash: string;
  external_id: string | null;
};

type UpsertDatasetRequestBody = {
  dataset: UpsertDatasetRequestSelector;
  examples: UpsertDatasetRequestExample[];
  sync_mode: "mirror";
};

type UpsertDatasetApiResponse = {
  data?: {
    data?: {
      dataset_id: string;
      version_id: string;
      summary?: UpsertDatasetSummary;
      is_noop?: boolean;
    };
  };
};

export type UpsertDatasetSummary = {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
};

export type UpsertDatasetParams = ClientFn & {
  dataset: UpsertDatasetSelector;
  examples: Example[];
};

export type UpsertDatasetResponse = {
  datasetId: string;
  versionId: string;
  summary?: UpsertDatasetSummary;
  isNoop?: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertNoNonFiniteNumbers(value: unknown): void {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(
      "Dataset examples must not contain NaN or Infinity values"
    );
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoNonFiniteNumbers);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(assertNoNonFiniteNumbers);
  }
}

function sortObjectKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysRecursively);
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortObjectKeysRecursively(value[key]);
        return sorted;
      }, {});
  }
  return value;
}

function normalizeSplits(example: Example): string[] {
  if (example.splits == null) {
    return [];
  }
  if (typeof example.splits === "string") {
    return [example.splits];
  }
  return example.splits;
}

function getDatasetSelector(
  dataset: UpsertDatasetSelector
): UpsertDatasetRequestSelector {
  if ("datasetId" in dataset) {
    return { id: dataset.datasetId };
  }
  return { name: dataset.datasetName };
}

function computeExampleContentHash(example: {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): string {
  const payload = {
    input: example.input,
    output: example.output,
    metadata: example.metadata,
  };
  const canonicalPayload = sortObjectKeysRecursively(payload);
  assertNoNonFiniteNumbers(canonicalPayload);
  const serializedPayload = JSON.stringify(canonicalPayload);
  invariant(
    serializedPayload,
    "Failed to serialize dataset example for content hashing"
  );
  return createHash("sha256").update(serializedPayload, "utf-8").digest("hex");
}

function toUpsertRequestExample(example: Example): UpsertDatasetRequestExample {
  const input = example.input;
  const output = example.output ?? {};
  const metadata = example.metadata ?? {};

  return {
    input,
    output,
    metadata,
    splits: normalizeSplits(example),
    span_id: example.spanId ?? null,
    external_id: example.externalId ?? null,
    content_hash: computeExampleContentHash({
      input,
      output,
      metadata,
    }),
  };
}

/**
 * Upsert dataset examples using mirror semantics.
 *
 * Hashing is computed implicitly in the client; users do not pass content hashes.
 */
export async function upsertDataset({
  client: _client,
  dataset,
  examples,
}: UpsertDatasetParams): Promise<UpsertDatasetResponse> {
  const client = _client || createClient();

  const requestBody: UpsertDatasetRequestBody = {
    dataset: getDatasetSelector(dataset),
    examples: examples.map(toUpsertRequestExample),
    sync_mode: "mirror",
  };

  const post = client.POST as unknown as (
    path: string,
    params: { body: UpsertDatasetRequestBody }
  ) => Promise<UpsertDatasetApiResponse>;

  const response = await post("/v1/datasets/upsert", {
    body: requestBody,
  });

  const responseData = response.data?.data;
  invariant(responseData, "Failed to upsert dataset");

  return {
    datasetId: responseData.dataset_id,
    versionId: responseData.version_id,
    summary: responseData.summary,
    isNoop: responseData.is_noop,
  };
}
