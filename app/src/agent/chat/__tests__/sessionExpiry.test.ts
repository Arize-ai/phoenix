import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentSessionGoneError,
  computeLocalExpiresAt,
  isAgentSessionGoneError,
} from "../sessionExpiry";

describe("computeLocalExpiresAt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts a relative expiry to a local deadline at receipt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    expect(computeLocalExpiresAt(60)).toBe(1_000_000 + 60_000);
  });

  it("maps a missing expiry to null", () => {
    expect(computeLocalExpiresAt(null)).toBeNull();
    expect(computeLocalExpiresAt(undefined)).toBeNull();
  });
});

describe("isAgentSessionGoneError", () => {
  it("matches the typed error", () => {
    expect(isAgentSessionGoneError(new AgentSessionGoneError())).toBe(true);
  });

  it("matches an error carrying the raw 404 response body", () => {
    expect(
      isAgentSessionGoneError(new Error('{"detail":"Session not found"}'))
    ).toBe(true);
  });

  it("rejects unrelated errors and non-errors", () => {
    expect(isAgentSessionGoneError(new Error("network down"))).toBe(false);
    expect(isAgentSessionGoneError("Session not found")).toBe(false);
    expect(isAgentSessionGoneError(null)).toBe(false);
  });
});
