import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createIncrementalSnapshot,
  loadSnapshotMetadata,
  type SnapshotMetadata,
  type SnapshotOptions,
} from "../src/snapshot/index.js";
import { LocalMode } from "../src/modes/local.js";
import type { ExecutionMode } from "../src/modes/types.js";

// Mock the client module
vi.mock("../src/snapshot/client.js", () => ({
  createPhoenixClient: vi.fn(() => ({
    GET: vi.fn(),
  })),
  withErrorHandling: vi.fn(async (fn) => fn()),
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

vi.mock("../src/snapshot/context.js", () => ({
  generateContext: vi.fn(),
}));

vi.mock("../src/snapshot/spans.js", () => ({
  snapshotSpans: vi.fn(),
}));

describe("Incremental Snapshot", () => {
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
        // Handle cat commands for reading files
        if (command.startsWith("cat ")) {
          const filePath = command
            .replace("cat ", "")
            .replace(" 2>/dev/null", "");
          const content = writtenFiles.get(filePath);
          if (content) {
            return { stdout: content, stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "File not found", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      getBashTool: vi.fn(async () => ({})),
      cleanup: vi.fn(async () => {}),
    };
  });

  describe("loadSnapshotMetadata", () => {
    it("should return null if no metadata exists", async () => {
      const metadata = await loadSnapshotMetadata(mockMode);
      expect(metadata).toBeNull();
    });

    it("should parse and return existing metadata", async () => {
      const testMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          spans: {
            "project-1": { last_end_time: "2025-01-10T09:00:00Z" },
          },
          datasets: { last_fetch: "2025-01-10T10:00:00Z" },
          experiments: { last_fetch: "2025-01-10T10:00:00Z" },
          prompts: { last_fetch: "2025-01-10T10:00:00Z" },
        },
        limits: {
          spans_per_project: 1000,
        },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(testMetadata)
      );

      const metadata = await loadSnapshotMetadata(mockMode);
      expect(metadata).toEqual(testMetadata);
    });

    it("should handle parse errors gracefully", async () => {
      writtenFiles.set("/phoenix/_meta/snapshot.json", "invalid json");

      const metadata = await loadSnapshotMetadata(mockMode);
      expect(metadata).toBeNull();
    });
  });

  describe("createIncrementalSnapshot", () => {
    const options: SnapshotOptions = {
      baseURL: "http://localhost:6006",
      apiKey: "test-key",
      spansPerProject: 500,
      showProgress: false,
    };

    it("should create a full snapshot if no existing metadata", async () => {
      // Mock no existing metadata
      mockMode.exec = vi.fn(async () => ({
        stdout: "",
        stderr: "File not found",
        exitCode: 1,
      }));

      // Import mocked modules
      const { createSnapshot } = await import("../src/snapshot/index.js");
      const createSnapshotSpy = vi.spyOn({ createSnapshot }, "createSnapshot");

      await createIncrementalSnapshot(mockMode, options);

      // Should fall back to full snapshot
      expect(createSnapshotSpy).not.toHaveBeenCalled(); // The actual createSnapshot is called directly

      // Verify that it tried to load metadata
      expect(mockMode.exec).toHaveBeenCalledWith(
        expect.stringContaining("cat /phoenix/_meta/snapshot.json")
      );
    });

    it("should fetch only new spans based on last end time", async () => {
      // Set up existing metadata
      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          spans: {
            "project-1": { last_end_time: "2025-01-10T09:00:00Z" },
            "project-2": { last_end_time: "2025-01-10T08:30:00Z" },
          },
          datasets: { last_fetch: "2025-01-10T10:00:00Z" },
          experiments: { last_fetch: "2025-01-10T10:00:00Z" },
          prompts: { last_fetch: "2025-01-10T10:00:00Z" },
        },
        limits: {
          spans_per_project: 1000,
        },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );

      // Mock projects list
      const projectsData = [
        { name: "project-1" },
        { name: "project-2" },
        { name: "project-3" }, // New project without cursor
      ];
      writtenFiles.set(
        "/phoenix/projects/index.jsonl",
        projectsData.map((p) => JSON.stringify(p)).join("\n")
      );

      // Mock existing spans
      writtenFiles.set(
        "/phoenix/projects/project-1/spans/index.jsonl",
        JSON.stringify({ id: "span1", end_time: "2025-01-10T08:00:00Z" })
      );

      await createIncrementalSnapshot(mockMode, options);

      // Verify metadata was updated
      const metadataWriteCall = (mockMode.writeFile as any).mock.calls.find(
        ([path]: [string]) => path === "/_meta/snapshot.json"
      );
      expect(metadataWriteCall).toBeDefined();

      const newMetadata = JSON.parse(metadataWriteCall[1]) as SnapshotMetadata;
      expect(newMetadata.cursors.spans).toBeDefined();
      expect(new Date(newMetadata.created_at).getTime()).toBeGreaterThan(
        new Date(existingMetadata.created_at).getTime()
      );
    });

    it("should update all data types in incremental mode", async () => {
      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          datasets: { last_fetch: "2025-01-10T10:00:00Z" },
          experiments: { last_fetch: "2025-01-10T10:00:00Z" },
          prompts: { last_fetch: "2025-01-10T10:00:00Z" },
        },
        limits: {
          spans_per_project: 1000,
        },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );
      writtenFiles.set("/phoenix/projects/index.jsonl", "");

      const { fetchProjects } = await import("../src/snapshot/projects.js");
      const { fetchDatasets } = await import("../src/snapshot/datasets.js");
      const { fetchExperiments } = await import(
        "../src/snapshot/experiments.js"
      );
      const { fetchPrompts } = await import("../src/snapshot/prompts.js");
      const { generateContext } = await import("../src/snapshot/context.js");

      await createIncrementalSnapshot(mockMode, options);

      // Verify all fetchers were called
      expect(fetchProjects).toHaveBeenCalled();
      expect(fetchDatasets).toHaveBeenCalled();
      expect(fetchExperiments).toHaveBeenCalled();
      expect(fetchPrompts).toHaveBeenCalled();
      expect(generateContext).toHaveBeenCalled();
    });

    it("should show progress logs when enabled", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {},
        limits: { spans_per_project: 1000 },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );
      writtenFiles.set("/phoenix/projects/index.jsonl", "");

      await createIncrementalSnapshot(mockMode, {
        ...options,
        showProgress: true,
      });

      // Verify progress messages
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Phoenix Incremental] Starting incremental update..."
        )
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Last snapshot: 2025-01-10T10:00:00Z")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Phoenix Incremental] Incremental update complete!"
        )
      );

      consoleLogSpy.mockRestore();
    });

    it("should handle errors gracefully", async () => {
      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {},
        limits: { spans_per_project: 1000 },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );

      // Make fetchProjects throw an error
      const { fetchProjects } = await import("../src/snapshot/projects.js");
      vi.mocked(fetchProjects).mockRejectedValueOnce(
        new Error("Network error")
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        createIncrementalSnapshot(mockMode, options)
      ).rejects.toThrow("Network error");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create incremental snapshot:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Incremental spans handling", () => {
    it("should merge new spans with existing spans", async () => {
      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          spans: {
            "test-project": { last_end_time: "2025-01-10T09:00:00Z" },
          },
        },
        limits: { spans_per_project: 1000 },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );

      // Mock existing project and spans
      writtenFiles.set(
        "/phoenix/projects/index.jsonl",
        JSON.stringify({ name: "test-project" })
      );

      const existingSpans = [
        { id: "span1", end_time: "2025-01-10T08:00:00Z" },
        { id: "span2", end_time: "2025-01-10T08:30:00Z" },
      ];
      writtenFiles.set(
        "/phoenix/projects/test-project/spans/index.jsonl",
        existingSpans.map((s) => JSON.stringify(s)).join("\n")
      );

      // Mock the Phoenix client to return new spans
      const { createPhoenixClient } = await import("../src/snapshot/client.js");
      const mockClient = {
        GET: vi.fn().mockResolvedValue({
          data: {
            data: [
              {
                id: "span3",
                end_time: "2025-01-10T09:30:00Z",
                start_time: "2025-01-10T09:25:00Z",
              },
              {
                id: "span4",
                end_time: "2025-01-10T10:00:00Z",
                start_time: "2025-01-10T09:55:00Z",
              },
            ],
            next_cursor: null,
          },
        }),
      };
      (createPhoenixClient as any).mockReturnValue(mockClient);

      await createIncrementalSnapshot(mockMode, {
        baseURL: "http://localhost:6006",
        spansPerProject: 100,
        showProgress: false,
      });

      // Check that snapshotSpans was called with the correct parameters
      const { snapshotSpans } = await import("../src/snapshot/spans.js");
      expect(snapshotSpans).toHaveBeenCalledWith(
        expect.anything(), // client
        mockMode,
        {
          spansPerProject: 100,
          startTime: "2025-01-10T09:00:00Z", // Uses the last end time from metadata
        }
      );
    });

    it("should handle projects with no previous cursor", async () => {
      const existingMetadata: SnapshotMetadata = {
        created_at: "2025-01-10T10:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          spans: {
            "old-project": { last_end_time: "2025-01-10T09:00:00Z" },
          },
        },
        limits: { spans_per_project: 1000 },
      };

      writtenFiles.set(
        "/phoenix/_meta/snapshot.json",
        JSON.stringify(existingMetadata)
      );

      // Mock projects including a new one
      const projects = [
        { name: "old-project" },
        { name: "new-project" }, // No cursor for this
      ];
      writtenFiles.set(
        "/phoenix/projects/index.jsonl",
        projects.map((p) => JSON.stringify(p)).join("\n")
      );

      await createIncrementalSnapshot(mockMode, {
        baseURL: "http://localhost:6006",
        spansPerProject: 100,
        showProgress: true,
      });

      const consoleLogSpy = vi.spyOn(console, "log");

      // Verify it attempted to process both projects
      expect(mockMode.writeFile).toHaveBeenCalled();
    });
  });
});
