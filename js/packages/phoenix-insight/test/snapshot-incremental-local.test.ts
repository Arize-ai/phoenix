import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createIncrementalSnapshot } from "../src/snapshot/index.js";
import { LocalMode } from "../src/modes/local.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock os module
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
  return {
    ...actual,
    homedir: vi.fn(),
  };
});

// Mock the client and sub-modules
vi.mock("../src/snapshot/client.js", () => ({
  createPhoenixClient: vi.fn(() => ({
    GET: vi.fn().mockResolvedValue({
      data: { data: [] },
    }),
  })),
  withErrorHandling: vi.fn(async (fn) => fn()),
}));

vi.mock("../src/snapshot/projects.js", () => ({
  fetchProjects: vi.fn(async (client, mode) => {
    await mode.writeFile(
      "/phoenix/projects/index.jsonl",
      JSON.stringify({ name: "test-project" })
    );
  }),
}));

vi.mock("../src/snapshot/datasets.js", () => ({
  fetchDatasets: vi.fn(async (client, mode) => {
    await mode.writeFile("/phoenix/datasets/index.jsonl", "");
  }),
}));

vi.mock("../src/snapshot/experiments.js", () => ({
  fetchExperiments: vi.fn(async (client, mode) => {
    await mode.writeFile("/phoenix/experiments/index.jsonl", "");
  }),
}));

vi.mock("../src/snapshot/prompts.js", () => ({
  fetchPrompts: vi.fn(async (client, mode) => {
    await mode.writeFile("/phoenix/prompts/index.jsonl", "");
  }),
}));

vi.mock("../src/snapshot/context.js", () => ({
  generateContext: vi.fn(async (mode) => {
    await mode.writeFile("/phoenix/_context.md", "# Context\nTest context");
  }),
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

vi.mock("../src/snapshot/spans.js", () => ({
  snapshotSpans: vi.fn(async (client, mode) => {
    await mode.writeFile(
      "/phoenix/projects/test-project/spans/index.jsonl",
      ""
    );
    await mode.writeFile(
      "/phoenix/projects/test-project/spans/metadata.json",
      JSON.stringify({
        project: "test-project",
        spanCount: 0,
        snapshotTime: new Date().toISOString(),
      })
    );
  }),
}));

describe("Incremental Snapshot with LocalMode", () => {
  let localMode: LocalMode;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `phoenix-insight-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock homedir to use our test directory
    vi.mocked(os.homedir).mockReturnValue(testDir);

    localMode = new LocalMode();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  it("should persist snapshots to disk in local mode", async () => {
    // Create initial snapshot
    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Verify snapshot was created on disk
    const snapshotDirs = await fs.readdir(
      path.join(testDir, ".phoenix-insight", "snapshots")
    );
    expect(snapshotDirs.length).toBe(1);

    const snapshotDir = path.join(
      testDir,
      ".phoenix-insight",
      "snapshots",
      snapshotDirs[0],
      "phoenix"
    );

    // Check that metadata file exists
    const metadataPath = path.join(snapshotDir, "_meta", "snapshot.json");
    const metadataExists = await fs
      .access(metadataPath)
      .then(() => true)
      .catch(() => false);
    expect(metadataExists).toBe(true);

    // Read and verify metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
    expect(metadata.phoenix_url).toBe("http://localhost:6006");
    expect(metadata.limits.spans_per_project).toBe(100);

    // Verify context file was created
    const contextPath = path.join(snapshotDir, "_context.md");
    const contextExists = await fs
      .access(contextPath)
      .then(() => true)
      .catch(() => false);
    expect(contextExists).toBe(true);
  });

  it("should create independent snapshots in local mode", async () => {
    // Create initial snapshot
    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Get the snapshot directory
    const snapshotDirs = await fs.readdir(
      path.join(testDir, ".phoenix-insight", "snapshots")
    );
    const firstSnapshotDir = snapshotDirs[0];

    // Verify first snapshot has metadata
    const firstMetadataPath = path.join(
      testDir,
      ".phoenix-insight",
      "snapshots",
      firstSnapshotDir,
      "phoenix",
      "_meta",
      "snapshot.json"
    );
    const firstMetadata = JSON.parse(
      await fs.readFile(firstMetadataPath, "utf-8")
    );
    expect(firstMetadata.phoenix_url).toBe("http://localhost:6006");

    // Create a new LocalMode instance (simulating a new run)
    const newLocalMode = new LocalMode();

    // Run another snapshot - it should create a full snapshot since each LocalMode
    // instance has its own directory and can't see previous snapshots
    await createIncrementalSnapshot(newLocalMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
      showProgress: true,
    });

    // Verify a new snapshot directory was created
    const newSnapshotDirs = await fs.readdir(
      path.join(testDir, ".phoenix-insight", "snapshots")
    );
    expect(newSnapshotDirs.length).toBe(2); // Original + new

    // Find the new snapshot
    const newSnapshotDir = newSnapshotDirs.find(
      (dir) => dir !== firstSnapshotDir
    );
    expect(newSnapshotDir).toBeDefined();

    // Verify the new snapshot has its own metadata
    const newMetadataPath = path.join(
      testDir,
      ".phoenix-insight",
      "snapshots",
      newSnapshotDir!,
      "phoenix",
      "_meta",
      "snapshot.json"
    );
    const newMetadata = JSON.parse(await fs.readFile(newMetadataPath, "utf-8"));

    // Each snapshot is independent with fresh metadata
    expect(newMetadata.phoenix_url).toBe("http://localhost:6006");
    expect(new Date(newMetadata.created_at).getTime()).toBeGreaterThan(
      new Date(firstMetadata.created_at).getTime()
    );
  });

  it("should handle missing previous snapshot gracefully", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Run incremental update without any existing snapshot
    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 50,
      showProgress: true,
    });

    // Should create a full snapshot
    const snapshotDirs = await fs.readdir(
      path.join(testDir, ".phoenix-insight", "snapshots")
    );
    expect(snapshotDirs.length).toBe(1);

    // Verify that a full snapshot was created (not incremental)
    const metadataPath = path.join(
      testDir,
      ".phoenix-insight",
      "snapshots",
      snapshotDirs[0],
      "phoenix",
      "_meta",
      "snapshot.json"
    );
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent);
    expect(metadata.phoenix_url).toBe("http://localhost:6006");

    consoleLogSpy.mockRestore();
  });

  it("should handle concurrent snapshot operations", async () => {
    // Create two LocalMode instances
    const mode1 = new LocalMode();
    const mode2 = new LocalMode();

    // Run two snapshots with a small delay to ensure different timestamps
    const promise1 = createIncrementalSnapshot(mode1, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    const promise2 = createIncrementalSnapshot(mode2, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Wait for both to complete
    await Promise.all([promise1, promise2]);

    // Both should succeed and create separate snapshot directories
    const snapshotDirs = await fs.readdir(
      path.join(testDir, ".phoenix-insight", "snapshots")
    );
    expect(snapshotDirs.length).toBe(2);

    // Verify both snapshots are valid
    for (const dir of snapshotDirs) {
      const metadataPath = path.join(
        testDir,
        ".phoenix-insight",
        "snapshots",
        dir,
        "phoenix",
        "_meta",
        "snapshot.json"
      );
      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);
      expect(metadataExists).toBe(true);
    }
  });
});
