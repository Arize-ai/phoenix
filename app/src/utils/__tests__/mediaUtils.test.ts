import { beforeEach, describe, expect, it, vi } from "vitest";

import { mediaDisplayName, resolveMediaUrl, uploadMedia } from "../mediaUtils";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));

vi.mock("@phoenix/authFetch", () => ({ authFetch: authFetchMock }));

const DIGEST = "a".repeat(64);

describe("resolveMediaUrl", () => {
  beforeEach(() => {
    window.Config = { ...window.Config, basename: "" };
  });

  it("serves a Phoenix media reference from the REST API", () => {
    expect(resolveMediaUrl(`phoenix://media/${DIGEST}`)).toBe(
      `/v1/media/${DIGEST}`
    );
  });

  it("respects a configured basename", () => {
    window.Config = { ...window.Config, basename: "/phoenix" };
    expect(resolveMediaUrl(`phoenix://media/${DIGEST}`)).toBe(
      `/phoenix/v1/media/${DIGEST}`
    );
  });

  it("leaves data URLs unchanged", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    expect(resolveMediaUrl(dataUrl)).toBe(dataUrl);
  });

  it("leaves http(s) URLs unchanged", () => {
    expect(resolveMediaUrl("https://example.com/cat.png")).toBe(
      "https://example.com/cat.png"
    );
  });

  it("leaves a redacted placeholder unchanged", () => {
    expect(resolveMediaUrl("__REDACTED__")).toBe("__REDACTED__");
  });
});

describe("uploadMedia", () => {
  const file = new File(["bytes"], "cat.png", { type: "image/png" });

  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it("posts the file as multipart and returns the stored reference", async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          sha256: DIGEST,
          media_type: "image/png",
          size_bytes: 5,
          url: `phoenix://media/${DIGEST}`,
        },
      }),
    });

    await expect(uploadMedia(file)).resolves.toEqual({
      url: `phoenix://media/${DIGEST}`,
      mediaType: "image/png",
    });

    const [, init] = authFetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("surfaces the server's reason for rejecting an upload", async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        detail: "Media exceeds the maximum supported size of 100 bytes.",
      }),
    });

    await expect(uploadMedia(file)).rejects.toThrow(
      "Media exceeds the maximum supported size of 100 bytes."
    );
  });

  it("falls back to a readable message when the error has no detail", async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => "not json we understand",
    });

    await expect(uploadMedia(file)).rejects.toThrow(
      "Could not upload cat.png."
    );
  });

  it("rejects when the success payload is not the expected shape", async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { unexpected: true } }),
    });

    await expect(uploadMedia(file)).rejects.toThrow(
      "Unexpected response while uploading cat.png."
    );
  });
});

describe("mediaDisplayName", () => {
  it("names stored media after its digest and media type", () => {
    expect(
      mediaDisplayName(`phoenix://media/${DIGEST}`, "application/pdf")
    ).toBe("aaaaaaaa.pdf");
    expect(mediaDisplayName(`phoenix://media/${DIGEST}`, "image/jpeg")).toBe(
      "aaaaaaaa.jpg"
    );
  });

  it("falls back to the media type's subtype for anything unmapped", () => {
    expect(mediaDisplayName(`phoenix://media/${DIGEST}`, "text/csv")).toBe(
      "aaaaaaaa.csv"
    );
  });

  /**
   * The name is derived rather than remembered, so it stays the same across
   * reloads. A data URL has no digest to derive from and just gets a generic name.
   */
  it("names inline media generically", () => {
    expect(
      mediaDisplayName("data:application/pdf;base64,AAAA", "application/pdf")
    ).toBe("media.pdf");
  });
});
