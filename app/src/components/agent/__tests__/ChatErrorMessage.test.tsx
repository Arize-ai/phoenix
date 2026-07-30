import { describe, expect, it } from "vitest";

import { isApiKeyError, isInsufficientStorageError } from "../ChatErrorMessage";

describe("isApiKeyError", () => {
  it("matches server-emitted API key guidance", () => {
    expect(
      isApiKeyError(
        "The model provider rejected the request because the API key is " +
          "missing, invalid, or misconfigured. Add a valid API key for the " +
          "selected model in Settings, then try again."
      )
    ).toBe(true);
  });

  it("matches build_model credential errors", () => {
    expect(
      isApiKeyError(
        "An API key is required for OpenAI models. Set the OPENAI_API_KEY " +
          "environment variable or store it in Phoenix secrets."
      )
    ).toBe(true);
  });

  it("matches raw provider auth failures", () => {
    expect(isApiKeyError("401 Unauthorized")).toBe(true);
    expect(isApiKeyError("Invalid x-api-key header")).toBe(true);
    expect(isApiKeyError("authentication_error: invalid token")).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isApiKeyError("provider unavailable")).toBe(false);
    expect(isApiKeyError("connection reset by peer")).toBe(false);
    expect(isApiKeyError(null)).toBe(false);
    expect(isApiKeyError(undefined)).toBe(false);
  });
});

describe("isInsufficientStorageError", () => {
  const serverMessage =
    "Database operations are disabled due to insufficient storage. " +
    "Please delete old data or increase storage.";

  it("matches the HTTP 507 body from a locked chat or compact request", () => {
    expect(isInsufficientStorageError(serverMessage)).toBe(true);
  });

  it("matches the message with a support contact appended", () => {
    expect(
      isInsufficientStorageError(
        `${serverMessage} Need help? Contact us at support@example.com`
      )
    ).toBe(true);
  });

  it("matches the notice raised when a turn's transcript could not be saved", () => {
    expect(
      isInsufficientStorageError(
        "The assistant replied, but the conversation could not be saved, " +
          `so this turn will be missing when you reload. ${serverMessage}`
      )
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isInsufficientStorageError("The assistant response failed.")).toBe(
      false
    );
    expect(isInsufficientStorageError("401 Unauthorized")).toBe(false);
    expect(isInsufficientStorageError(null)).toBe(false);
    expect(isInsufficientStorageError(undefined)).toBe(false);
  });

  it("is disjoint from the API-key matcher, so the two banners cannot collide", () => {
    expect(isApiKeyError(serverMessage)).toBe(false);
  });
});
