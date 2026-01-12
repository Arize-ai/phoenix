import { describe, it, expect, vi } from "vitest";
import {
  PhoenixClientError,
  withErrorHandling,
  extractData,
} from "../../src/snapshot/client";

// Mock the phoenix-client module
vi.mock("@arizeai/phoenix-client", () => ({
  createClient: vi.fn(),
}));

describe("withErrorHandling", () => {
  it("should return successful result", async () => {
    const operation = vi.fn().mockResolvedValue({ data: "success" });

    const result = await withErrorHandling(operation, "test operation");

    expect(result).toEqual({ data: "success" });
  });

  it("should handle network errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Network error during test operation: Unable to connect to Phoenix server",
        "NETWORK_ERROR",
        expect.any(TypeError)
      )
    );
  });

  it("should handle authentication errors (401)", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error("http://localhost:6006/api/v1/projects: 401 Unauthorized")
      );

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Authentication error during test operation: Unauthorized",
        "AUTH_ERROR",
        expect.any(Error)
      )
    );
  });

  it("should handle authentication errors (403)", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error("http://localhost:6006/api/v1/projects: 403 Forbidden")
      );

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Authentication error during test operation: Forbidden",
        "AUTH_ERROR",
        expect.any(Error)
      )
    );
  });

  it("should handle client errors (4xx)", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error("http://localhost:6006/api/v1/projects: 404 Not Found")
      );

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Client error during test operation: 404 Not Found",
        "INVALID_RESPONSE",
        expect.any(Error)
      )
    );
  });

  it("should handle server errors (5xx)", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "http://localhost:6006/api/v1/projects: 500 Internal Server Error"
        )
      );

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Server error during test operation: 500 Internal Server Error",
        "NETWORK_ERROR",
        expect.any(Error)
      )
    );
  });

  it("should handle unknown errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error("Something went wrong"));

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Unexpected error during test operation: Something went wrong",
        "UNKNOWN_ERROR",
        expect.any(Error)
      )
    );
  });

  it("should handle non-Error objects", async () => {
    const operation = vi.fn().mockRejectedValue("string error");

    await expect(
      withErrorHandling(operation, "test operation")
    ).rejects.toThrow(
      new PhoenixClientError(
        "Unexpected error during test operation: string error",
        "UNKNOWN_ERROR",
        "string error"
      )
    );
  });
});

describe("extractData", () => {
  it("should return data from successful response", () => {
    const response = { data: { id: 1, name: "test" } };

    const result = extractData(response);

    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("should throw error if response contains error", () => {
    const response = { error: new Error("API error") };

    expect(() => extractData(response)).toThrow(new Error("API error"));
  });

  it("should throw PhoenixClientError if data is missing", () => {
    const response = {};

    expect(() => extractData(response)).toThrow(
      new PhoenixClientError(
        "Invalid API response: missing data",
        "INVALID_RESPONSE"
      )
    );
  });

  it("should handle null data as invalid", () => {
    const response = { data: null };

    expect(() => extractData(response as any)).toThrow(
      new PhoenixClientError(
        "Invalid API response: missing data",
        "INVALID_RESPONSE"
      )
    );
  });

  it("should handle undefined data as invalid", () => {
    const response = { data: undefined };

    expect(() => extractData(response)).toThrow(
      new PhoenixClientError(
        "Invalid API response: missing data",
        "INVALID_RESPONSE"
      )
    );
  });
});

describe("PhoenixClientError", () => {
  it("should create error with correct properties", () => {
    const originalError = new Error("Original error");
    const error = new PhoenixClientError(
      "Test error",
      "NETWORK_ERROR",
      originalError
    );

    expect(error.message).toBe("Test error");
    expect(error.name).toBe("PhoenixClientError");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.originalError).toBe(originalError);
  });

  it("should create error without originalError", () => {
    const error = new PhoenixClientError("Test error", "AUTH_ERROR");

    expect(error.message).toBe("Test error");
    expect(error.name).toBe("PhoenixClientError");
    expect(error.code).toBe("AUTH_ERROR");
    expect(error.originalError).toBeUndefined();
  });
});
