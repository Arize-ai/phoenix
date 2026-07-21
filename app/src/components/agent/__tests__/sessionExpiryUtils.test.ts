import { describe, expect, it } from "vitest";

import { getSessionRetentionLabel } from "../sessionExpiryUtils";

const NOW = Date.parse("2026-07-01T12:00:00Z");
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

describe("getSessionRetentionLabel", () => {
  it("returns null when there is no expiry and the session is under the cap", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: null,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBeNull();
  });

  it("returns null when the expiry is beyond the expiring-soon window", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW + 8 * ONE_DAY_MS,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBeNull();
  });

  it("shows a day countdown inside the expiring-soon window", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW + 3 * ONE_DAY_MS,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBe("expires in 3d");
  });

  it("shows an hour countdown inside the final day", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW + 5 * ONE_HOUR_MS,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBe("expires in 5h");
  });

  it("reads as deleted soon once the deadline is within the hourly sweep", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW + ONE_HOUR_MS / 2,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBe("deleted soon");
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW - ONE_DAY_MS,
        isOverCountCap: false,
        now: NOW,
      })
    ).toBe("deleted soon");
  });

  it("reads as deleted soon when over the per-user count cap regardless of expiry", () => {
    expect(
      getSessionRetentionLabel({
        expiresAt: NOW + 30 * ONE_DAY_MS,
        isOverCountCap: true,
        now: NOW,
      })
    ).toBe("deleted soon");
  });
});
