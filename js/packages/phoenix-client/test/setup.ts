import { vi } from "vitest";

vi.mock("../src/utils/serverVersionUtils", () => ({
  capabilityLabel: vi.fn(),
  ensureServerCapability: vi.fn(),
}));
