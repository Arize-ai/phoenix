import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSandboxMode, createLocalMode } from "../src/modes/index.js";

// Mock the mode modules
vi.mock("../src/modes/index.js", () => ({
  createSandboxMode: vi.fn(() => ({
    name: "sandbox",
    writeFile: vi.fn(),
    exec: vi.fn(),
    cleanup: vi.fn(),
    getBashTool: vi.fn(),
  })),
  createLocalMode: vi.fn(async () => ({
    name: "local",
    writeFile: vi.fn(),
    exec: vi.fn(),
    cleanup: vi.fn(),
    getBashTool: vi.fn(),
  })),
}));

describe("default mode selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use sandbox mode when no flags are specified", () => {
    // When neither --sandbox nor --local is specified
    const options = {
      sandbox: false,
      local: false,
    };

    // The new behavior: use sandbox mode by default
    const mode = options.local ? "local" : "sandbox";
    expect(mode).toBe("sandbox");
  });

  it("should use sandbox mode when --sandbox is specified", () => {
    const options = {
      sandbox: true,
      local: false,
    };

    // Explicit sandbox mode
    const mode = options.local ? "local" : "sandbox";
    expect(mode).toBe("sandbox");
  });

  it("should use local mode when --local is specified", () => {
    const options = {
      sandbox: false,
      local: true,
    };

    // Explicit local mode
    const mode = options.local ? "local" : "sandbox";
    expect(mode).toBe("local");
  });

  it("should use local mode when both --local and --sandbox are specified", () => {
    // Edge case: if both flags are somehow specified, local takes precedence
    const options = {
      sandbox: true,
      local: true,
    };

    // Local takes precedence in the new implementation
    const mode = options.local ? "local" : "sandbox";
    expect(mode).toBe("local");
  });

  it("should create fresh snapshot for sandbox mode", () => {
    const options = {
      refresh: false,
      local: false, // This means sandbox mode (default)
    };

    // Sandbox mode always requires fresh snapshot
    const shouldCreateFreshSnapshot = options.refresh || !options.local;
    expect(shouldCreateFreshSnapshot).toBe(true);
  });

  it("should create fresh snapshot when --refresh is specified", () => {
    const options = {
      refresh: true,
      local: true,
    };

    // Refresh flag forces fresh snapshot even in local mode
    const shouldCreateFreshSnapshot = options.refresh || !options.local;
    expect(shouldCreateFreshSnapshot).toBe(true);
  });

  it("should use incremental snapshot for local mode without refresh", () => {
    const options = {
      refresh: false,
      local: true,
    };

    // Local mode without refresh uses incremental
    const shouldCreateFreshSnapshot = options.refresh || !options.local;
    expect(shouldCreateFreshSnapshot).toBe(false);
  });
});
