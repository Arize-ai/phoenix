import { describe, expect, it } from "vitest";

import { isApiKeyError } from "../ChatErrorMessage";

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
