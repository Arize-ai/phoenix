import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { addSessionNote } from "../../src/sessions/addSessionNote";

const mockPOST = vi.fn();

describe("addSessionNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPOST.mockResolvedValue({
      data: {
        data: { id: "test-session-note-id-1" },
      },
      error: null,
    });
  });

  function makeClient() {
    return {
      getServerVersion: async () => [14, 17, 0] as [number, number, number],
      POST: mockPOST,
    };
  }

  it("adds a session note", async () => {
    const result = await addSessionNote({
      client: makeClient() as never,
      sessionNote: {
        sessionId: "session-123",
        note: "This is a session note",
      },
    });

    expect(result).toEqual({ id: "test-session-note-id-1" });
  });

  it("trims the session ID", async () => {
    await addSessionNote({
      client: makeClient() as never,
      sessionNote: {
        sessionId: "  session-123  ",
        note: "This is a session note",
      },
    });

    expect(mockPOST).toHaveBeenCalledWith("/v1/session_notes", {
      body: {
        data: {
          session_id: "session-123",
          note: "This is a session note",
        },
      },
    });
  });

  it("throws when the API returns an error", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: "Session not found",
    });

    await expect(
      addSessionNote({
        client: makeClient() as never,
        sessionNote: {
          sessionId: "missing-session",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: Session not found");
  });

  it("formats FastAPI detail errors", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { detail: "Session not found" },
    });

    await expect(
      addSessionNote({
        client: makeClient() as never,
        sessionNote: {
          sessionId: "missing-session",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: Session not found");
  });

  it("throws when no data is returned", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    await expect(
      addSessionNote({
        client: makeClient() as never,
        sessionNote: {
          sessionId: "session-123",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: no data returned");
  });

  it("fails fast on older Phoenix servers", async () => {
    const guardedPOST = vi.fn();
    const mockClient = {
      getServerVersion: async () => [14, 16, 0] as [number, number, number],
      POST: guardedPOST,
    };

    await expect(
      addSessionNote({
        client: mockClient as never,
        sessionNote: {
          sessionId: "session-123",
          note: "This is a session note",
        },
      })
    ).rejects.toThrow(/requires Phoenix server >= 14\.17\.0/);

    expect(guardedPOST).not.toHaveBeenCalled();
  });
});
