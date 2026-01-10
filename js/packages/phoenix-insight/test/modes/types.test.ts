import { describe, it, expect, vi } from "vitest";
import type { ExecutionMode } from "../../src/modes/types";

describe("ExecutionMode interface", () => {
  it("should define the required methods", () => {
    // Create a mock implementation to verify the interface shape
    const mockMode: ExecutionMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      getBashTool: vi.fn().mockReturnValue({}),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    // Verify all methods exist
    expect(mockMode.writeFile).toBeDefined();
    expect(mockMode.exec).toBeDefined();
    expect(mockMode.getBashTool).toBeDefined();
    expect(mockMode.cleanup).toBeDefined();

    // Verify methods are functions
    expect(typeof mockMode.writeFile).toBe("function");
    expect(typeof mockMode.exec).toBe("function");
    expect(typeof mockMode.getBashTool).toBe("function");
    expect(typeof mockMode.cleanup).toBe("function");
  });

  it("writeFile should accept path and content", async () => {
    const mockMode: ExecutionMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };

    await mockMode.writeFile("/test/path.txt", "test content");

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/test/path.txt",
      "test content"
    );
  });

  it("exec should return stdout, stderr, and exitCode", async () => {
    const expectedResult = {
      stdout: "command output",
      stderr: "error output",
      exitCode: 0,
    };

    const mockMode: ExecutionMode = {
      writeFile: vi.fn(),
      exec: vi.fn().mockResolvedValue(expectedResult),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };

    const result = await mockMode.exec("ls -la");

    expect(mockMode.exec).toHaveBeenCalledWith("ls -la");
    expect(result).toEqual(expectedResult);
  });

  it("getBashTool should return a tool", () => {
    const mockTool = { name: "bash", execute: vi.fn() };

    const mockMode: ExecutionMode = {
      writeFile: vi.fn(),
      exec: vi.fn(),
      getBashTool: vi.fn().mockReturnValue(mockTool),
      cleanup: vi.fn(),
    };

    const tool = mockMode.getBashTool();

    expect(mockMode.getBashTool).toHaveBeenCalled();
    expect(tool).toBe(mockTool);
  });

  it("cleanup should be async", async () => {
    const mockMode: ExecutionMode = {
      writeFile: vi.fn(),
      exec: vi.fn(),
      getBashTool: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    await mockMode.cleanup();

    expect(mockMode.cleanup).toHaveBeenCalled();
  });
});
