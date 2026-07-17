import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentSessionNotFoundError,
  computeLocalExpiresAt,
  isAgentSessionNotFoundError,
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

describe("isAgentSessionNotFoundError", () => {
  it("matches the typed error", () => {
    expect(isAgentSessionNotFoundError(new AgentSessionNotFoundError())).toBe(
      true
    );
  });
});
