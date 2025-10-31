import { components } from "../../src/__generated__/api/v1";
import { getExperimentRuns } from "../../src/experiments";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const mockExperimentRuns: components["schemas"]["ListExperimentRunsResponseBody"]["data"] =
  [
    {
      id: "id",
      experiment_id: "exp_id",
      dataset_example_id: "example_id",
      output: { response: "res" },
      repetition_number: 1,
      start_time: "2025-09-20T02:54:17.638Z",
      end_time: "2025-09-20T02:54:17.638Z",
    },
  ];

describe("getExperimentRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });
  it("should not paginate if the API doesn't provide a next cursor", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: mockExperimentRuns,
      },
    });
    await getExperimentRuns({ experimentId: "fake" });
    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/runs",
      {
        params: {
          path: {
            experiment_id: "fake",
          },
          query: {
            cursor: null,
            limit: 100,
          },
        },
      }
    );
  });
  it("should paginate through records and fetch all", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: mockExperimentRuns,
          next_cursor: "c1",
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockExperimentRuns,
          next_cursor: "c2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockExperimentRuns,
          next_cursor: null,
        },
      });
    const { runs } = await getExperimentRuns({ experimentId: "fake" });
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(runs.length).toEqual(3);
  });
});
