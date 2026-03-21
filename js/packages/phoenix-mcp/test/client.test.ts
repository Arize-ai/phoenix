import { describe, expect, it, vi } from "vitest";

import {
  looksLikePhoenixDatasetId,
  looksLikePhoenixProjectId,
  resolveDatasetId,
  resolveProjectId,
} from "../src/client";

describe("identifier helpers", () => {
  it("recognizes hex-like project IDs", () => {
    expect(looksLikePhoenixProjectId("abcdef1234")).toBe(true);
    expect(looksLikePhoenixProjectId("default")).toBe(false);
  });

  it("recognizes hex-like dataset IDs", () => {
    expect(looksLikePhoenixDatasetId("abcdef1234")).toBe(true);
    expect(looksLikePhoenixDatasetId("support-dataset")).toBe(false);
  });

  it("recognizes relay dataset IDs", () => {
    expect(looksLikePhoenixDatasetId("RGF0YXNldDox")).toBe(true);
  });
});

describe("entity resolution", () => {
  it("resolves project names through the API", async () => {
    const client = {
      GET: vi.fn().mockResolvedValue({
        data: {
          data: {
            id: "abc123",
          },
        },
      }),
    } as never;

    await expect(
      resolveProjectId({
        client,
        projectIdentifier: "default",
      })
    ).resolves.toBe("abc123");
  });

  it("resolves dataset names through the API", async () => {
    const client = {
      GET: vi.fn().mockResolvedValue({
        data: {
          data: [
            {
              id: "def456",
            },
          ],
        },
      }),
    } as never;

    await expect(
      resolveDatasetId({
        client,
        datasetIdentifier: "support-dataset",
      })
    ).resolves.toBe("def456");
  });
});
