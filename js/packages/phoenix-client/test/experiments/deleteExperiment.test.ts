import { deleteExperiment } from "../../src/experiments/deleteExperiment";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the fetch module
const mockDelete = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    DELETE: mockDelete,
    use: () => {},
  }),
}));

describe("deleteExperiment", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should delete an experiment successfully", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      deleteExperiment({
        experimentId: "exp-123",
      })
    ).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith("/v1/experiments/{experiment_id}", {
      params: {
        path: {
          experiment_id: "exp-123",
        },
      },
    });
  });

  it("should throw error when experiment is not found (404)", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        status: 404,
        message: "Not Found",
      },
    });

    await expect(
      deleteExperiment({
        experimentId: "nonexistent-exp",
      })
    ).rejects.toThrow("Experiment not found: nonexistent-exp");
  });

  it("should throw error for other API errors", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        status: 500,
        message: "Internal Server Error",
      },
    });

    await expect(
      deleteExperiment({
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });

  it("should handle errors without status", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        message: "Unknown error",
      },
    });

    await expect(
      deleteExperiment({
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });

  it("should handle string errors", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: "Something went wrong",
    });

    await expect(
      deleteExperiment({
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment: Something went wrong");
  });

  it("should handle null errors", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      deleteExperiment({
        experimentId: "exp-123",
      })
    ).resolves.toBeUndefined();
  });

  it("should handle errors with detailed response", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        status: 400,
        message: "Bad Request",
        details: {
          field: "experimentId",
          issue: "invalid format",
        },
      },
    });

    await expect(
      deleteExperiment({
        experimentId: "bad-id",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });
});
