import { deleteSpan } from "../../src/spans/deleteSpan";

import { beforeEach,describe, expect, it, vi } from "vitest";

// Mock the fetch module
const mockDelete = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    DELETE: mockDelete,
    use: () => {},
  }),
}));

describe("deleteSpan", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should delete a span successfully", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      deleteSpan({
        spanIdentifier: "test-span-123",
      })
    ).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith("/v1/spans/{span_identifier}", {
      params: {
        path: {
          span_identifier: "test-span-123",
        },
      },
    });
  });

  it("should delete a span by OpenTelemetry span_id", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      deleteSpan({
        spanIdentifier: "abc123def456",
      })
    ).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith("/v1/spans/{span_identifier}", {
      params: {
        path: {
          span_identifier: "abc123def456",
        },
      },
    });
  });

  it("should delete a span by Phoenix Global ID", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      deleteSpan({
        spanIdentifier: "U3BhbjoyMzQ1Njc4OQ==",
      })
    ).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith("/v1/spans/{span_identifier}", {
      params: {
        path: {
          span_identifier: "U3BhbjoyMzQ1Njc4OQ==",
        },
      },
    });
  });

  it("should throw error when span is not found (404)", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        status: 404,
        message: "Not Found",
      },
    });

    await expect(
      deleteSpan({
        spanIdentifier: "nonexistent-span",
      })
    ).rejects.toThrow("Span not found: nonexistent-span");
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
      deleteSpan({
        spanIdentifier: "test-span-123",
      })
    ).rejects.toThrow("Failed to delete span:");
  });

  it("should handle errors without message", async () => {
    mockDelete.mockResolvedValue({
      data: null,
      error: {
        status: 400,
      },
    });

    await expect(
      deleteSpan({
        spanIdentifier: "test-span-123",
      })
    ).rejects.toThrow("Failed to delete span:");
  });
});
