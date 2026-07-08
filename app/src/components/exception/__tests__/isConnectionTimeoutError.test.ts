import { describe, expect, it } from "vitest";

import { isConnectionTimeoutError } from "../isConnectionTimeoutError";

describe("isConnectionTimeoutError", () => {
  describe("returns true for connection timeout errors", () => {
    it("detects Chrome JSON parse error from HTML response", () => {
      expect(
        isConnectionTimeoutError(
          `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
        )
      ).toBe(true);
    });

    it("detects Firefox JSON parse error from HTML response", () => {
      expect(
        isConnectionTimeoutError(
          "JSON.parse: unexpected character at line 1 column 1 of the JSON data"
        )
      ).toBe(true);
    });

    it("detects error messages containing DOCTYPE", () => {
      expect(isConnectionTimeoutError("<!DOCTYPE html>")).toBe(true);
    });

    it("detects timeout errors", () => {
      expect(isConnectionTimeoutError("Request timeout")).toBe(true);
      expect(isConnectionTimeoutError("Connection timeout")).toBe(true);
    });

    it("detects gateway errors", () => {
      expect(isConnectionTimeoutError("502 Bad Gateway")).toBe(true);
      expect(isConnectionTimeoutError("504 Gateway Timeout")).toBe(true);
      expect(isConnectionTimeoutError("Bad Gateway")).toBe(true);
    });

    it("works with Error objects", () => {
      const error = new Error(
        `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
      );
      expect(isConnectionTimeoutError(error)).toBe(true);
    });
  });

  describe("returns false for non-timeout errors", () => {
    it("returns false for null", () => {
      expect(isConnectionTimeoutError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isConnectionTimeoutError(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isConnectionTimeoutError("")).toBe(false);
    });

    it("returns false for regular errors", () => {
      expect(isConnectionTimeoutError("Something went wrong")).toBe(false);
      expect(isConnectionTimeoutError("TypeError: Cannot read property")).toBe(
        false
      );
      expect(isConnectionTimeoutError("Network error")).toBe(false);
    });

    it("returns false for valid JSON parse errors not caused by HTML", () => {
      expect(
        isConnectionTimeoutError("Unexpected token 'u' in JSON at position 0")
      ).toBe(false);
    });
  });
});
