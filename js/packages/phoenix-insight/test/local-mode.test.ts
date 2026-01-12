import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";

// Mock modules before imports
vi.mock("node:fs/promises");

// Mock os.homedir to return a predictable path
vi.mock("node:os", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:os");
  return {
    ...actual,
    homedir: vi.fn().mockReturnValue("/mock/home"),
  };
});

// Store the mock exec async function that we'll control in tests
let mockExecAsyncFn: (
  command: string,
  options: any
) => Promise<{ stdout: string; stderr: string }>;

// Mock util.promisify to return our controlled function for exec
vi.mock("node:util", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:util");
  return {
    ...actual,
    promisify: (fn: any) => {
      // Check if this is the exec function by checking if it's from child_process
      // We identify it by checking if our mock returns a controlled async function
      if (fn.name === "exec" || fn.toString().includes("child_process")) {
        return async (command: string, options: any) => {
          return mockExecAsyncFn(command, options);
        };
      }
      // For other functions, use the real promisify
      return actual.promisify(fn);
    },
  };
});

// Get mocked functions
const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);

// Import LocalMode after mocks are set up
import { LocalMode } from "../src/modes/local.js";

/**
 * Helper to mock execAsync for success
 */
function mockExecSuccess(stdout: string, stderr = ""): void {
  mockExecAsyncFn = async (_command: string, _options: any) => {
    return { stdout, stderr };
  };
}

/**
 * Helper to mock execAsync for failure with exit code
 */
function mockExecFailure(exitCode: number, stdout = "", stderr = ""): void {
  mockExecAsyncFn = async (_command: string, _options: any) => {
    const error = Object.assign(new Error("Command failed"), {
      code: exitCode,
      stdout,
      stderr,
    });
    throw error;
  };
}

/**
 * Helper to capture exec options and succeed
 */
function mockExecCapture(): {
  getOptions: () => any;
  getCommand: () => string;
} {
  let capturedOptions: any = null;
  let capturedCommand = "";

  mockExecAsyncFn = async (command: string, options: any) => {
    capturedCommand = command;
    capturedOptions = options;
    return { stdout: "", stderr: "" };
  };

  return {
    getOptions: () => capturedOptions,
    getCommand: () => capturedCommand,
  };
}

describe("LocalMode", () => {
  let localMode: LocalMode;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    // Default exec implementation - succeeds with empty output
    mockExecSuccess("", "");

    localMode = new LocalMode();
  });

  afterEach(async () => {
    await localMode.cleanup();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create workDir under ~/.phoenix-insight/snapshots/", () => {
      const workDir = (localMode as any).workDir;

      // Should use mocked homedir
      expect(workDir).toMatch(/^\/mock\/home\/\.phoenix-insight\/snapshots\//);
      // Should have timestamp and /phoenix suffix
      expect(workDir).toMatch(
        /\/mock\/home\/\.phoenix-insight\/snapshots\/\d+-\w+\/phoenix$/
      );
    });
  });

  describe("writeFile", () => {
    it("should write a file to the local filesystem", async () => {
      const content = "Hello, Phoenix!";
      await localMode.writeFile("/test.txt", content);

      // Should have created directory
      expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });

      // Should have written file
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("test.txt"),
        content,
        "utf-8"
      );
    });

    it("should create nested directories", async () => {
      const content = '{"name": "test-project"}';
      await localMode.writeFile("/projects/test/metadata.json", content);

      // Should create parent directories
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/test$/),
        { recursive: true }
      );

      // Should write file to nested path
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("projects/test/metadata.json"),
        content,
        "utf-8"
      );
    });

    it("should handle paths with /phoenix prefix", async () => {
      const content = "test data";
      await localMode.writeFile("/phoenix/data.txt", content);

      // Should strip /phoenix prefix and write to root
      const writeCall = mockWriteFile.mock.calls[0];
      const writePath = writeCall[0] as string;

      // The path should end with data.txt, not /phoenix/data.txt
      expect(writePath).toMatch(/\/phoenix\/data\.txt$/);
      expect(writePath).not.toMatch(/\/phoenix\/phoenix\/data\.txt$/);
    });

    it("should handle absolute paths without leading slash", async () => {
      const content = "test";
      await localMode.writeFile("relative/path.txt", content);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("relative/path.txt"),
        content,
        "utf-8"
      );
    });

    it("should propagate mkdir errors", async () => {
      mockMkdir.mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(localMode.writeFile("/test.txt", "content")).rejects.toThrow(
        "EACCES"
      );
    });

    it("should propagate writeFile errors", async () => {
      mockWriteFile.mockRejectedValue(new Error("ENOSPC: no space left"));

      await expect(localMode.writeFile("/test.txt", "content")).rejects.toThrow(
        "ENOSPC"
      );
    });
  });

  describe("exec", () => {
    it("should execute bash commands and return result", async () => {
      mockExecSuccess("output\n", "");

      const result = await localMode.exec("echo hello");

      expect(result).toEqual({
        stdout: "output\n",
        stderr: "",
        exitCode: 0,
      });
    });

    it("should execute commands in the correct directory", async () => {
      const { getOptions } = mockExecCapture();

      await localMode.exec("pwd");

      const options = getOptions();
      // Should execute in workDir
      expect(options.cwd).toBe((localMode as any).workDir);
      expect(options.shell).toBe("/bin/bash");
    });

    it("should handle command failures with exit code", async () => {
      mockExecFailure(1, "", "No such file or directory");

      const result = await localMode.exec("cat non-existent-file.txt");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No such file");
    });

    it("should handle unknown errors (no code property)", async () => {
      mockExecAsyncFn = async () => {
        throw new Error("Unknown error");
      };

      const result = await localMode.exec("some-command");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("Unknown error");
    });

    it("should include stdout from failed commands", async () => {
      mockExecFailure(2, "partial output", "error message");

      const result = await localMode.exec("failing-command");

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("partial output");
      expect(result.stderr).toBe("error message");
    });

    it("should set timeout for commands", async () => {
      const { getOptions } = mockExecCapture();

      await localMode.exec("long-running-command");

      const options = getOptions();
      expect(options.timeout).toBe(60000);
    });
  });

  describe("getBashTool", () => {
    it("should return a bash tool for AI SDK", async () => {
      const tool = await localMode.getBashTool();

      expect(tool).toBeDefined();
      expect(tool.description).toContain("bash");
      expect(typeof tool.execute).toBe("function");
    });

    it("should cache the bash tool", async () => {
      const tool1 = await localMode.getBashTool();
      const tool2 = await localMode.getBashTool();

      // Should return the same instance
      expect(tool1).toBe(tool2);
    });

    it("should execute commands through the bash tool", async () => {
      mockExecSuccess("Hello from tool!", "");

      const tool = await localMode.getBashTool();
      const result = await tool.execute({ command: "cat test.txt" });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe("Hello from tool!");
      expect(result.exitCode).toBe(0);
    });

    it("should handle errors through the bash tool", async () => {
      mockExecFailure(1, "", "No such file or directory");

      const tool = await localMode.getBashTool();
      const result = await tool.execute({ command: "cat /does/not/exist" });

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.error).toContain("Command failed");
    });
  });

  describe("cleanup", () => {
    it("should not throw errors on cleanup", async () => {
      // Cleanup should be a no-op for now
      await expect(localMode.cleanup()).resolves.not.toThrow();
    });
  });

  describe("init", () => {
    it("should create working directory on first operation", async () => {
      await localMode.writeFile("/test.txt", "content");

      // Should have called mkdir with the workDir
      expect(mockMkdir).toHaveBeenCalledWith((localMode as any).workDir, {
        recursive: true,
      });
    });

    it("should propagate init errors", async () => {
      mockMkdir.mockRejectedValue(new Error("Failed to create directory"));

      await expect(localMode.writeFile("/test.txt", "content")).rejects.toThrow(
        "Failed to initialize local mode directory"
      );
    });
  });

  describe("path handling", () => {
    it("should normalize paths with multiple slashes", async () => {
      await localMode.writeFile("//multiple//slashes.txt", "content");

      const writeCall = mockWriteFile.mock.calls[0];
      const writePath = writeCall[0] as string;

      // Path should contain the filename
      expect(writePath).toContain("slashes.txt");
    });

    it("should handle empty file paths", async () => {
      // Empty path should still create a file in workDir
      await localMode.writeFile("", "content");

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });
});
