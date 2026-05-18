import { afterEach, describe, expect, it } from "vitest";

import type { BackendInfo } from "../types";
import { shouldShowLocalDenoTrustWarning } from "../utils";

type TrustWarningBackend = Pick<BackendInfo, "backendType" | "status">;

const denoBackend = (status: BackendInfo["status"]): TrustWarningBackend => ({
  backendType: "DENO",
  status,
});

const initialManagementUrl = window.Config.managementUrl;

afterEach(() => {
  window.Config.managementUrl = initialManagementUrl;
});

describe("shouldShowLocalDenoTrustWarning", () => {
  it("returns true for DENO + AVAILABLE + no managementUrl (self-hosted)", () => {
    window.Config.managementUrl = undefined;
    expect(shouldShowLocalDenoTrustWarning(denoBackend("AVAILABLE"))).toBe(
      true
    );
  });

  it("returns true for DENO + AVAILABLE when managementUrl is null (self-hosted)", () => {
    window.Config.managementUrl = null;
    expect(shouldShowLocalDenoTrustWarning(denoBackend("AVAILABLE"))).toBe(
      true
    );
  });

  it("returns false for DENO + AVAILABLE in managed deployment (managementUrl set)", () => {
    window.Config.managementUrl = "https://manage.example.com";
    expect(shouldShowLocalDenoTrustWarning(denoBackend("AVAILABLE"))).toBe(
      false
    );
  });

  it("returns false for DENO + UNAVAILABLE even when self-hosted", () => {
    window.Config.managementUrl = undefined;
    expect(shouldShowLocalDenoTrustWarning(denoBackend("UNAVAILABLE"))).toBe(
      false
    );
  });

  it("returns false for DENO + NOT_INSTALLED even when self-hosted", () => {
    window.Config.managementUrl = undefined;
    expect(shouldShowLocalDenoTrustWarning(denoBackend("NOT_INSTALLED"))).toBe(
      false
    );
  });

  it("returns false for DENO + MISSING_CREDENTIALS even when self-hosted", () => {
    window.Config.managementUrl = undefined;
    expect(
      shouldShowLocalDenoTrustWarning(denoBackend("MISSING_CREDENTIALS"))
    ).toBe(false);
  });

  it("returns false for non-DENO backends regardless of status", () => {
    window.Config.managementUrl = undefined;
    const wasm: TrustWarningBackend = {
      backendType: "WASM",
      status: "AVAILABLE",
    };
    expect(shouldShowLocalDenoTrustWarning(wasm)).toBe(false);
  });

  it("returns false when backend is undefined (no provider selected)", () => {
    window.Config.managementUrl = undefined;
    expect(shouldShowLocalDenoTrustWarning(undefined)).toBe(false);
  });
});
