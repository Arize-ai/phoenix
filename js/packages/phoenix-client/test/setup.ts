import { vi } from "vitest";

vi.mock("../src/utils/serverVersionUtils", () => ({
  featureLabel: vi.fn(),
  ensureServerFeature: vi.fn(),
}));
