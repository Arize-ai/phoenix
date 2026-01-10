import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSnapshot,
  createIncrementalSnapshot,
  loadSnapshotMetadata,
} from "../../src/snapshot/index.js";
import type { ExecutionMode } from "../../src/modes/types.js";
import * as client from "../../src/snapshot/client.js";
import * as projects from "../../src/snapshot/projects.js";
import * as spans from "../../src/snapshot/spans.js";
import * as datasets from "../../src/snapshot/datasets.js";
import * as experiments from "../../src/snapshot/experiments.js";
import * as prompts from "../../src/snapshot/prompts.js";
import * as context from "../../src/snapshot/context.js";

// Mock all the snapshot modules
vi.mock("../../src/snapshot/client.js");
vi.mock("../../src/snapshot/projects.js");
vi.mock("../../src/snapshot/spans.js");
vi.mock("../../src/snapshot/datasets.js");
vi.mock("../../src/snapshot/experiments.js");
vi.mock("../../src/snapshot/prompts.js");
vi.mock("../../src/snapshot/context.js");

describe("snapshot orchestrator", () => {
  let mockMode: ExecutionMode;
  let mockClient: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Create mock execution mode
    mockMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      getBashTool: vi.fn().mockResolvedValue({}),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock Phoenix client
    mockClient = {};

    // Set up spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset all mocks
    vi.mocked(client.createPhoenixClient).mockReturnValue(mockClient);
    vi.mocked(projects.fetchProjects).mockResolvedValue(undefined);
    vi.mocked(spans.snapshotSpans).mockResolvedValue(undefined);
    vi.mocked(datasets.fetchDatasets).mockResolvedValue(undefined);
    vi.mocked(experiments.fetchExperiments).mockResolvedValue(undefined);
    vi.mocked(prompts.fetchPrompts).mockResolvedValue(undefined);
    vi.mocked(context.generateContext).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSnapshot", () => {
    it("should orchestrate all fetchers in the correct order", async () => {
      const options = {
        baseURL: "http://localhost:6006",
        apiKey: "test-key",
        spansPerProject: 500,
      };

      await createSnapshot(mockMode, options);

      // Verify client was created with correct config
      expect(client.createPhoenixClient).toHaveBeenCalledWith({
        baseURL: "http://localhost:6006",
        apiKey: "test-key",
      });

      // Verify all fetchers were called in order
      expect(projects.fetchProjects).toHaveBeenCalledWith(mockClient, mockMode);
      expect(spans.snapshotSpans).toHaveBeenCalledWith(mockClient, mockMode, {
        spansPerProject: 500,
        startTime: undefined,
        endTime: undefined,
      });
      expect(datasets.fetchDatasets).toHaveBeenCalledWith(mockClient, mockMode);
      expect(experiments.fetchExperiments).toHaveBeenCalledWith(
        mockClient,
        mockMode
      );
      expect(prompts.fetchPrompts).toHaveBeenCalledWith(mockClient, mockMode);
      expect(context.generateContext).toHaveBeenCalledWith(mockMode, {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: expect.any(Date),
        spansPerProject: 500,
      });

      // Verify metadata was written
      expect(mockMode.writeFile).toHaveBeenCalledWith(
        "/_meta/snapshot.json",
        expect.stringContaining('"phoenix_url": "http://localhost:6006"')
      );
    });

    it("should pass time filters to spans", async () => {
      const options = {
        baseURL: "http://localhost:6006",
        startTime: "2025-01-01T00:00:00Z",
        endTime: "2025-01-10T00:00:00Z",
      };

      await createSnapshot(mockMode, options);

      expect(spans.snapshotSpans).toHaveBeenCalledWith(mockClient, mockMode, {
        spansPerProject: 1000, // default
        startTime: "2025-01-01T00:00:00Z",
        endTime: "2025-01-10T00:00:00Z",
      });
    });

    it("should show progress when enabled", async () => {
      const options = {
        baseURL: "http://localhost:6006",
        showProgress: true,
      };

      await createSnapshot(mockMode, options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Snapshot] Starting snapshot..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Snapshot] Fetching projects..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Snapshot] Fetching spans..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Snapshot] Snapshot complete!"
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Network error");
      vi.mocked(projects.fetchProjects).mockRejectedValue(error);

      const options = {
        baseURL: "http://localhost:6006",
      };

      await expect(createSnapshot(mockMode, options)).rejects.toThrow(
        "Network error"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create snapshot:",
        error
      );
    });
  });

  describe("loadSnapshotMetadata", () => {
    it("should return parsed metadata when file exists", async () => {
      const mockMetadata = {
        created_at: "2025-01-10T00:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {},
        limits: { spans_per_project: 1000 },
      };

      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: JSON.stringify(mockMetadata),
        stderr: "",
        exitCode: 0,
      });

      const result = await loadSnapshotMetadata(mockMode);

      expect(mockMode.exec).toHaveBeenCalledWith(
        "cat /phoenix/_meta/snapshot.json 2>/dev/null"
      );
      expect(result).toEqual(mockMetadata);
    });

    it("should return null when file doesn't exist", async () => {
      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: "",
        stderr: "cat: /phoenix/_meta/snapshot.json: No such file or directory",
        exitCode: 1,
      });

      const result = await loadSnapshotMetadata(mockMode);
      expect(result).toBeNull();
    });

    it("should return null on JSON parse error", async () => {
      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: "invalid json",
        stderr: "",
        exitCode: 0,
      });

      const result = await loadSnapshotMetadata(mockMode);
      expect(result).toBeNull();
    });
  });

  describe("createIncrementalSnapshot", () => {
    it("should create full snapshot when no existing metadata", async () => {
      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 1,
      });

      const options = {
        baseURL: "http://localhost:6006",
      };

      await createIncrementalSnapshot(mockMode, options);

      // Should call createSnapshot internally, which calls all fetchers
      expect(projects.fetchProjects).toHaveBeenCalled();
      expect(spans.snapshotSpans).toHaveBeenCalled();
      expect(datasets.fetchDatasets).toHaveBeenCalled();
    });

    it("should use existing cursors for incremental update", async () => {
      const existingMetadata = {
        created_at: "2025-01-09T00:00:00Z",
        phoenix_url: "http://localhost:6006",
        cursors: {
          spans: {
            "project-1": { last_end_time: "2025-01-09T10:00:00Z" },
            "project-2": { last_end_time: "2025-01-09T09:00:00Z" },
          },
          datasets: { last_fetch: "2025-01-09T00:00:00Z" },
        },
        limits: { spans_per_project: 1000 },
      };

      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: JSON.stringify(existingMetadata),
        stderr: "",
        exitCode: 0,
      });

      const options = {
        baseURL: "http://localhost:6006",
        spansPerProject: 500,
      };

      await createIncrementalSnapshot(mockMode, options);

      // Should use the latest end time as start time
      expect(spans.snapshotSpans).toHaveBeenCalledWith(mockClient, mockMode, {
        spansPerProject: 500,
        startTime: "2025-01-09T10:00:00Z",
      });

      // Should preserve existing cursors in metadata
      const metadataCall = vi
        .mocked(mockMode.writeFile)
        .mock.calls.find((call) => call[0] === "/_meta/snapshot.json");
      expect(metadataCall).toBeDefined();
      const writtenMetadata = JSON.parse(metadataCall![1]);
      expect(writtenMetadata.cursors.spans).toEqual(
        existingMetadata.cursors.spans
      );
    });

    it("should show incremental progress when enabled", async () => {
      vi.mocked(mockMode.exec).mockResolvedValue({
        stdout: JSON.stringify({
          created_at: "2025-01-09T00:00:00Z",
          phoenix_url: "http://localhost:6006",
          cursors: {},
          limits: { spans_per_project: 1000 },
        }),
        stderr: "",
        exitCode: 0,
      });

      const options = {
        baseURL: "http://localhost:6006",
        showProgress: true,
      };

      await createIncrementalSnapshot(mockMode, options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Incremental] Starting incremental update..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Incremental] Updating projects..."
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Phoenix Incremental] Incremental update complete!"
      );
    });
  });
});
