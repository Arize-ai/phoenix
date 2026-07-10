import { ENV_PHOENIX_DISCOVER_CONFIG } from "@arizeai/phoenix-config";
import { vi } from "vitest";

process.env[ENV_PHOENIX_DISCOVER_CONFIG] = "false";

// Capability-guard tests must unmock this module to exercise real version checks.
vi.mock("../src/utils/serverVersionUtils", () => ({
  capabilityLabel: vi.fn(),
  ensureServerCapability: vi.fn(),
}));
