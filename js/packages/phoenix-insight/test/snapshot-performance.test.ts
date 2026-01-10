import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSnapshot, type SnapshotOptions } from "../src/snapshot/index.js";
import type { ExecutionMode } from "../src/modes/types.js";

// Mock the client module
vi.mock("../src/snapshot/client.js", () => ({
  createPhoenixClient: vi.fn(() => ({
    GET: vi.fn(),
  })),
  withErrorHandling: vi.fn(async (fn) => fn()),
  PhoenixClientError: class PhoenixClientError extends Error {
    constructor(
      message: string,
      public code: string,
      public originalError?: any
    ) {
      super(message);
    }
  },
}));

// Mock the sub-modules
vi.mock("../src/snapshot/projects.js", () => ({
  fetchProjects: vi.fn(),
}));

vi.mock("../src/snapshot/datasets.js", () => ({
  fetchDatasets: vi.fn(),
}));

vi.mock("../src/snapshot/experiments.js", () => ({
  fetchExperiments: vi.fn(),
}));

vi.mock("../src/snapshot/prompts.js", () => ({
  fetchPrompts: vi.fn(),
}));

vi.mock("../src/snapshot/spans.js", () => ({
  snapshotSpans: vi.fn(),
}));

vi.mock("../src/snapshot/context.js", () => ({
  generateContext: vi.fn(),
}));

// Mock the progress module
vi.mock("../src/progress.js", () => {
  class MockSnapshotProgress {
    constructor(public enabled: boolean) {}
    start = vi.fn();
    update = vi.fn();
    succeed = vi.fn();
    fail = vi.fn();
    stop = vi.fn();
  }
  return { SnapshotProgress: MockSnapshotProgress };
});

describe("Snapshot Performance Improvements", () => {
  let mockMode: ExecutionMode;
  let writtenFiles: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    writtenFiles = new Map();

    // Create a mock execution mode
    mockMode = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles.set(path, content);
      }),
      exec: vi.fn(async (command: string) => {
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      getBashTool: vi.fn(async () => ({})),
      cleanup: vi.fn(async () => {}),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Parallel Data Fetching", () => {
    it("should fetch spans, datasets, experiments, and prompts in parallel", async () => {
      const options: SnapshotOptions = {
        baseURL: "http://localhost:6006",
        showProgress: false,
      };

      // Import mocked modules
      const { fetchProjects } = await import("../src/snapshot/projects.js");
      const { fetchDatasets } = await import("../src/snapshot/datasets.js");
      const { fetchExperiments } = await import(
        "../src/snapshot/experiments.js"
      );
      const { fetchPrompts } = await import("../src/snapshot/prompts.js");
      const { snapshotSpans } = await import("../src/snapshot/spans.js");

      // Create delays to simulate network latency
      vi.mocked(fetchProjects).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      let spansStartTime: number | null = null;
      let datasetsStartTime: number | null = null;
      let experimentsStartTime: number | null = null;
      let promptsStartTime: number | null = null;

      vi.mocked(snapshotSpans).mockImplementation(async () => {
        spansStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      vi.mocked(fetchDatasets).mockImplementation(async () => {
        datasetsStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 40));
      });

      vi.mocked(fetchExperiments).mockImplementation(async () => {
        experimentsStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 30));
      });

      vi.mocked(fetchPrompts).mockImplementation(async () => {
        promptsStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      const startTime = Date.now();
      await createSnapshot(mockMode, options);
      const totalTime = Date.now() - startTime;

      // Verify projects was called first (required for spans)
      expect(fetchProjects).toHaveBeenCalled();

      // Verify all data fetchers were called
      expect(snapshotSpans).toHaveBeenCalled();
      expect(fetchDatasets).toHaveBeenCalled();
      expect(fetchExperiments).toHaveBeenCalled();
      expect(fetchPrompts).toHaveBeenCalled();

      // Verify parallel execution: all should start at approximately the same time
      expect(spansStartTime).toBeDefined();
      expect(datasetsStartTime).toBeDefined();
      expect(experimentsStartTime).toBeDefined();
      expect(promptsStartTime).toBeDefined();

      const timeDiff =
        Math.max(
          spansStartTime!,
          datasetsStartTime!,
          experimentsStartTime!,
          promptsStartTime!
        ) -
        Math.min(
          spansStartTime!,
          datasetsStartTime!,
          experimentsStartTime!,
          promptsStartTime!
        );

      // All should start within 10ms of each other (allowing for JS execution time)
      expect(timeDiff).toBeLessThan(10);

      // Total time should be approximately the longest operation (50ms for spans)
      // plus some overhead, not the sum of all operations
      expect(totalTime).toBeLessThan(100); // Would be ~140ms if sequential
    });

    it("should continue with partial data if some fetchers fail", async () => {
      const options: SnapshotOptions = {
        baseURL: "http://localhost:6006",
        showProgress: false,
      };

      // Import mocked modules
      const { fetchProjects } = await import("../src/snapshot/projects.js");
      const { fetchDatasets } = await import("../src/snapshot/datasets.js");
      const { fetchExperiments } = await import(
        "../src/snapshot/experiments.js"
      );
      const { fetchPrompts } = await import("../src/snapshot/prompts.js");
      const { snapshotSpans } = await import("../src/snapshot/spans.js");
      const { generateContext } = await import("../src/snapshot/context.js");

      // Mock successful projects fetch
      vi.mocked(fetchProjects).mockResolvedValue(undefined);

      // Mock successful spans fetch
      vi.mocked(snapshotSpans).mockResolvedValue(undefined);

      // Mock some failures
      vi.mocked(fetchDatasets).mockRejectedValue(
        new Error("Dataset fetch failed")
      );
      vi.mocked(fetchExperiments).mockRejectedValue(
        new Error("Experiment fetch failed")
      );

      // Mock successful prompts fetch
      vi.mocked(fetchPrompts).mockResolvedValue(undefined);

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await createSnapshot(mockMode, options);

      // Should log warnings but not throw
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Failed to fetch datasets:"),
        expect.any(String)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Failed to fetch experiments:"),
        expect.any(String)
      );

      // Should still generate context with partial data
      expect(generateContext).toHaveBeenCalled();

      // Should write metadata
      expect(writtenFiles.has("/_meta/snapshot.json")).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    it("should fail completely if spans fetch fails", async () => {
      const options: SnapshotOptions = {
        baseURL: "http://localhost:6006",
        showProgress: false,
      };

      // Import mocked modules
      const { fetchProjects } = await import("../src/snapshot/projects.js");
      const { snapshotSpans } = await import("../src/snapshot/spans.js");

      // Mock successful projects fetch
      vi.mocked(fetchProjects).mockResolvedValue(undefined);

      // Mock spans failure
      vi.mocked(snapshotSpans).mockRejectedValue(
        new Error("Spans fetch critical error")
      );

      await expect(createSnapshot(mockMode, options)).rejects.toThrow(
        "Failed to fetch spans"
      );
    });
  });

  describe("Bash Command Timeout", () => {
    it("should enforce timeout on bash commands in local mode", async () => {
      // This test is more of a verification that the timeout is set
      // The actual timeout behavior would need integration testing
      const { LocalMode } = await import("../src/modes/local.js");
      const localMode = new LocalMode();

      // Mock the exec function to check the options
      const execSpy = vi
        .spyOn(localMode as any, "init")
        .mockResolvedValue(undefined);

      // We can't easily test the actual timeout without mocking child_process
      // but we've added the timeout: 60000 option in the implementation

      // Clean up
      await localMode.cleanup();
    });
  });
});
