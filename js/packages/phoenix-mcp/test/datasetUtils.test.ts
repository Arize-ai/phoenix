import { describe, expect, it, vi } from "vitest";

import { isPhoenixDatasetId, resolveDatasetId } from "../src/datasetUtils";
import { parseRelayGlobalId } from "../src/identifiers";

describe("relay ID helpers", () => {
  it("parses relay IDs into type and node ID parts", () => {
    expect(parseRelayGlobalId(" UHJvamVjdDox ")).toEqual({
      typeName: "Project",
      nodeId: "1",
    });
  });

  it("rejects non-relay IDs", () => {
    expect(parseRelayGlobalId("default")).toBeNull();
    expect(parseRelayGlobalId("cafe")).toBeNull();
  });

  it("recognizes relay dataset IDs", () => {
    expect(isPhoenixDatasetId("RGF0YXNldDox")).toBe(true);
    expect(isPhoenixDatasetId("support-dataset")).toBe(false);
    expect(isPhoenixDatasetId("dead")).toBe(false);
  });
});

describe("dataset resolution", () => {
  it("returns trimmed relay dataset IDs without calling the API", async () => {
    const client = {
      GET: vi.fn(),
    } as never;

    await expect(
      resolveDatasetId({
        client,
        datasetId: " RGF0YXNldDox ",
      })
    ).resolves.toBe("RGF0YXNldDox");

    expect(client.GET).not.toHaveBeenCalled();
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
        datasetName: "support-dataset",
      })
    ).resolves.toBe("def456");

    expect(client.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: {
        query: {
          name: "support-dataset",
          limit: 1,
        },
      },
    });
  });
});
