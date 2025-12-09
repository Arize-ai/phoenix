import { addSpanNote } from "../../src/spans/addSpanNote";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock POST function
const mockPOST = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: { id: "test-note-id-1" },
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("addSpanNote", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset default mock behavior
    mockPOST.mockResolvedValue({
      data: {
        data: { id: "test-note-id-1" },
      },
      error: null,
    });
  });

  it("should add a span note", async () => {
    const result = await addSpanNote({
      spanNote: {
        spanId: "123abc",
        note: "This is a test note",
      },
    });

    expect(result).toEqual({ id: "test-note-id-1" });
  });

  it("should trim span ID", async () => {
    await addSpanNote({
      spanNote: {
        spanId: "  123abc  ",
        note: "This is a test note",
      },
    });

    expect(mockPOST).toHaveBeenCalledWith("/v1/span_notes", {
      body: {
        data: {
          span_id: "123abc",
          note: "This is a test note",
        },
      },
    });
  });

  it("should throw error when API returns error", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: "Span not found",
    });

    await expect(
      addSpanNote({
        spanNote: {
          spanId: "nonexistent",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add span note: Span not found");
  });

  it("should throw error when no data is returned", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    await expect(
      addSpanNote({
        spanNote: {
          spanId: "123abc",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add span note: no data returned");
  });
});
