import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertDataset } from "../../src/datasets/upsertDataset";

const mockPost = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    use: () => {},
  }),
}));

describe("upsertDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should hash examples implicitly and ignore user-supplied content_hash", async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          dataset_id: "dataset-123",
          version_id: "version-1",
          summary: { added: 1, updated: 0, deleted: 0, unchanged: 0 },
          is_noop: false,
        },
      },
    });

    const exampleWithUserHash = {
      input: { question: "What is AI?" },
      output: { answer: "..." },
      metadata: { source: "faq" },
      content_hash: "bad-user-hash",
    };

    await upsertDataset({
      dataset: { datasetName: "support-benchmark" },
      examples: [exampleWithUserHash],
    });

    const requestBody = mockPost.mock.calls[0]?.[1]?.body;
    expect(requestBody.dataset).toEqual({ name: "support-benchmark" });
    expect(requestBody.sync_mode).toBe("mirror");
    expect(requestBody.examples[0].content_hash).toHaveLength(64);
    expect(requestBody.examples[0].content_hash).not.toBe("bad-user-hash");
  });

  it("should support create, evolve, and exact no-op re-upsert flows", async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: "dataset-123",
            version_id: "version-1",
            summary: { added: 2, updated: 0, deleted: 0, unchanged: 0 },
            is_noop: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: "dataset-123",
            version_id: "version-2",
            summary: { added: 1, updated: 1, deleted: 1, unchanged: 0 },
            is_noop: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: "dataset-123",
            version_id: "version-2",
            summary: { added: 0, updated: 0, deleted: 0, unchanged: 2 },
            is_noop: true,
          },
        },
      });

    const examplesV1 = [
      {
        input: { question: "What is AI?" },
        output: { answer: "..." },
        metadata: {},
      },
      {
        input: { question: "What is ML?" },
        output: { answer: "..." },
        metadata: {},
      },
    ];

    const examplesV2 = [
      {
        input: { question: "What is AI?" },
        output: { answer: "Artificial Intelligence" },
        metadata: {},
      },
      {
        input: { question: "What is RL?" },
        output: { answer: "..." },
        metadata: {},
      },
    ];

    const first = await upsertDataset({
      dataset: { datasetName: "support-benchmark" },
      examples: examplesV1,
    });

    const second = await upsertDataset({
      dataset: { datasetName: "support-benchmark" },
      examples: examplesV2,
    });

    const third = await upsertDataset({
      dataset: { datasetName: "support-benchmark" },
      examples: examplesV2,
    });

    expect(first).toEqual({
      datasetId: "dataset-123",
      versionId: "version-1",
      summary: { added: 2, updated: 0, deleted: 0, unchanged: 0 },
      isNoop: false,
    });

    expect(second).toEqual({
      datasetId: "dataset-123",
      versionId: "version-2",
      summary: { added: 1, updated: 1, deleted: 1, unchanged: 0 },
      isNoop: false,
    });

    expect(third).toEqual({
      datasetId: "dataset-123",
      versionId: "version-2",
      summary: { added: 0, updated: 0, deleted: 0, unchanged: 2 },
      isNoop: true,
    });

    expect(mockPost).toHaveBeenCalledTimes(3);

    const firstHash =
      mockPost.mock.calls[0]?.[1]?.body.examples[0].content_hash;
    const secondHash =
      mockPost.mock.calls[1]?.[1]?.body.examples[0].content_hash;
    const thirdHash =
      mockPost.mock.calls[2]?.[1]?.body.examples[0].content_hash;

    expect(firstHash).not.toBe(secondHash);
    expect(secondHash).toBe(thirdHash);
  });

  it("should produce deterministic hashes regardless of object key order", async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: "dataset-123",
            version_id: "version-1",
            summary: { added: 1, updated: 0, deleted: 0, unchanged: 0 },
            is_noop: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: "dataset-123",
            version_id: "version-1",
            summary: { added: 0, updated: 0, deleted: 0, unchanged: 1 },
            is_noop: true,
          },
        },
      });

    await upsertDataset({
      dataset: { datasetId: "dataset-123" },
      examples: [
        {
          input: { b: 2, a: 1 },
          output: { z: 9, y: 8 },
          metadata: { m: 7, n: 6 },
        },
      ],
    });

    await upsertDataset({
      dataset: { datasetId: "dataset-123" },
      examples: [
        {
          input: { a: 1, b: 2 },
          output: { y: 8, z: 9 },
          metadata: { n: 6, m: 7 },
        },
      ],
    });

    const firstHash =
      mockPost.mock.calls[0]?.[1]?.body.examples[0].content_hash;
    const secondHash =
      mockPost.mock.calls[1]?.[1]?.body.examples[0].content_hash;

    expect(firstHash).toBe(secondHash);
  });
});
