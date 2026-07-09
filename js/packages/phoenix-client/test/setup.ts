import { vi } from "vitest";

process.env.PHOENIX_DISCOVER_CONFIG = "false";

// Capability-guard tests must unmock this module to exercise real version checks.
vi.mock("../src/utils/serverVersionUtils", () => ({
  capabilityLabel: vi.fn(),
  ensureServerCapability: vi.fn(),
}));
