import { isolatePhoenixEnvForTesting } from "@arizeai/phoenix-config";
import { vi } from "vitest";

isolatePhoenixEnvForTesting();

// Capability-guard tests must unmock this module to exercise real version checks.
vi.mock("../src/utils/serverVersionUtils", () => ({
  capabilityLabel: vi.fn(),
  ensureServerCapability: vi.fn(),
}));
