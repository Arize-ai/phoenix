import { describe, expect, it } from "vitest";

import type { BackendInfo } from "../types";
import { shouldShowRuntimeUnavailableBadge } from "../utils";

type BadgeBackend = Pick<BackendInfo, "hostingType" | "status">;

const backend = (
  hostingType: BackendInfo["hostingType"],
  status: BackendInfo["status"]
): BadgeBackend => ({ hostingType, status });

describe("shouldShowRuntimeUnavailableBadge", () => {
  it("badges a local backend that can't run (e.g. WASM in no-local-storage mode)", () => {
    expect(
      shouldShowRuntimeUnavailableBadge(backend("LOCAL", "UNAVAILABLE"))
    ).toBe(true);
  });

  it("does not badge a healthy local backend", () => {
    expect(
      shouldShowRuntimeUnavailableBadge(backend("LOCAL", "AVAILABLE"))
    ).toBe(false);
  });

  it("never badges a hosted backend, even when unavailable", () => {
    expect(
      shouldShowRuntimeUnavailableBadge(backend("HOSTED", "UNAVAILABLE"))
    ).toBe(false);
  });
});
