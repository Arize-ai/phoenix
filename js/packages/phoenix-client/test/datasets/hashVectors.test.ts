import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertDataset } from "../../src/datasets/upsertDataset";

type HashVectorExample = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type HashVector = {
  name: string;
  canonical_json: string;
  expected_hash: string;
  examples: HashVectorExample[];
};

type HashVectorFixture = {
  vectors: HashVector[];
};

const mockPost = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    use: () => {},
  }),
}));

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../tests/fixtures/dataset_upsert_hash_vectors.json"
);
const hashVectors = JSON.parse(
  readFileSync(fixturePath, "utf-8")
) as HashVectorFixture;

describe("dataset hash vectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should match shared golden vectors", async () => {
    for (const vector of hashVectors.vectors) {
      const canonicalHash = createHash("sha256")
        .update(vector.canonical_json, "utf-8")
        .digest("hex");
      expect(canonicalHash).toBe(vector.expected_hash);

      for (const example of vector.examples) {
        mockPost.mockResolvedValueOnce({
          data: {
            data: {
              dataset_id: "dataset-123",
              version_id: "version-1",
            },
          },
        });

        await upsertDataset({
          dataset: { datasetName: "golden-vectors" },
          examples: [example],
        });

        const requestBody = mockPost.mock.calls.at(-1)?.[1]?.body;
        expect(requestBody.examples[0].content_hash).toBe(vector.expected_hash);
      }
    }
  });
});
