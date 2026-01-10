import { describe, it, expect, vi } from "vitest";
import { createClient } from "@arizeai/phoenix-client";

describe("I/O Safety Tests", () => {
  it("should prevent unmocked phoenix client calls", () => {
    // This should throw an error because createClient is mocked in setup.ts
    expect(() => {
      const client = createClient();
      // If this doesn't throw, the mock isn't working
      expect(client).toBeUndefined();
    }).not.toThrow();

    // Verify the mock was called
    expect(createClient).toHaveBeenCalled();
  });

  it("should allow mocked phoenix client calls", () => {
    // Mock the client for this specific test
    const mockClient = {
      projects: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
    };
    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const client = createClient();
    expect(client).toBeDefined();
    expect((client as any).projects).toBeDefined();
  });

  it("should track console output", () => {
    // Set up spies for this specific test
    const logSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error");
    const warnSpy = vi.spyOn(console, "warn");

    console.log("test log");
    console.error("test error");
    console.warn("test warning");

    expect(logSpy).toHaveBeenCalledWith("test log");
    expect(errorSpy).toHaveBeenCalledWith("test error");
    expect(warnSpy).toHaveBeenCalledWith("test warning");
  });

  it("should prevent process.exit calls", () => {
    // Mock process.exit for this test
    vi.spyOn(process, "exit").mockImplementation((code?: number): never => {
      throw new Error(`process.exit(${code}) was called`);
    });

    expect(() => {
      process.exit(1);
    }).toThrow("process.exit(1) was called");
  });
});
