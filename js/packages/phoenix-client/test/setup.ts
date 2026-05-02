import { vi } from "vitest";

// Capability-guard tests must unmock this module to exercise real version checks.
vi.mock("../src/utils/serverVersionUtils", () => ({
  capabilityLabel: vi.fn(),
  ensureServerCapability: vi.fn(),
}));
