import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSessionSelfCancellationGraceActive,
  SESSION_CANCELLATION_GRACE_MS,
} from "../sessionCancellation";

describe("isSessionSelfCancellationGraceActive", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when no cancellation marker is present", () => {
    expect(isSessionSelfCancellationGraceActive(undefined)).toBe(false);
    expect(isSessionSelfCancellationGraceActive(null)).toBe(false);
  });

  it("returns true when within the cancellation grace period", () => {
    const cancelledAt = 1_000_000;
    expect(
      isSessionSelfCancellationGraceActive(cancelledAt, cancelledAt + 1_000)
    ).toBe(true);
  });

  it("returns false when the cancellation grace period has expired", () => {
    const cancelledAt = 1_000_000;
    expect(
      isSessionSelfCancellationGraceActive(
        cancelledAt,
        cancelledAt + SESSION_CANCELLATION_GRACE_MS + 1
      )
    ).toBe(false);
    expect(
      isSessionSelfCancellationGraceActive(cancelledAt, cancelledAt + 10_000)
    ).toBe(false);
  });

  it("handles boundary conditions at exact grace limits and clock skew", () => {
    const cancelledAt = 1_000_000;

    // Exactly at cancellation time (0ms elapsed) -> active
    expect(isSessionSelfCancellationGraceActive(cancelledAt, cancelledAt)).toBe(
      true
    );

    // Exactly at grace period limit (3_000ms elapsed) -> active
    expect(
      isSessionSelfCancellationGraceActive(
        cancelledAt,
        cancelledAt + SESSION_CANCELLATION_GRACE_MS
      )
    ).toBe(true);

    // 1ms past grace period limit -> expired
    expect(
      isSessionSelfCancellationGraceActive(
        cancelledAt,
        cancelledAt + SESSION_CANCELLATION_GRACE_MS + 1
      )
    ).toBe(false);

    // Negative elapsed time (timestamp in future / clock skew) -> false
    expect(
      isSessionSelfCancellationGraceActive(cancelledAt, cancelledAt - 1)
    ).toBe(false);
  });

  it("defaults to Date.now() for the current time", () => {
    vi.useFakeTimers();
    const systemTime = new Date("2026-11-01T00:00:00.000Z");
    vi.setSystemTime(systemTime);

    const cancelledAt = systemTime.getTime() - 1_000;
    expect(isSessionSelfCancellationGraceActive(cancelledAt)).toBe(true);

    vi.advanceTimersByTime(SESSION_CANCELLATION_GRACE_MS);
    expect(isSessionSelfCancellationGraceActive(cancelledAt)).toBe(false);
  });
});
