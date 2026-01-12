import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";

// Mock fs/promises before imports
vi.mock("node:fs/promises");

// Mock os module
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
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
      // Check if this is the exec function
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

// Get mocked fs functions
const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);

// Import after mocks
import { createIncrementalSnapshot } from "../src/snapshot/index.js";
import { LocalMode } from "../src/modes/local.js";

/**
 * Helper to mock execAsync for success
 */
function mockExecSuccess(stdout: string, stderr = ""): void {
  mockExecAsyncFn = async () => ({ stdout, stderr });
}

/**
 * Helper to track files written via the mocked fs.writeFile
 */
interface WrittenFile {
  path: string;
  content: string;
}

function getWrittenFiles(): WrittenFile[] {
  return mockWriteFile.mock.calls.map((call) => ({
    path: call[0] as string,
    content: call[1] as string,
  }));
}

/**
 * Helper to find a written file by path pattern
 */
function findWrittenFile(pattern: RegExp): WrittenFile | undefined {
  return getWrittenFiles().find((file) => pattern.test(file.path));
}

describe("Incremental Snapshot with LocalMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure os.homedir returns the mock value
    vi.mocked(os.homedir).mockReturnValue("/mock/home");

    // Set up default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    // Default exec - return empty (no existing snapshot metadata)
    mockExecSuccess("", "");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should persist snapshots to disk in local mode", async () => {
    const localMode = new LocalMode();

    // Create initial snapshot
    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Verify workDir was created under ~/.phoenix-insight/snapshots/
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/mock\/home\/\.phoenix-insight\/snapshots\/\d+-\w+\/phoenix$/
      ),
      { recursive: true }
    );

    // Check that metadata file was written
    const metadataFile = findWrittenFile(/\/_meta\/snapshot\.json$/);
    expect(metadataFile).toBeDefined();

    // Verify metadata content
    const metadata = JSON.parse(metadataFile!.content);
    expect(metadata.phoenix_url).toBe("http://localhost:6006");
    expect(metadata.limits.spans_per_project).toBe(100);

    // Verify context file was written
    const contextFile = findWrittenFile(/_context\.md$/);
    expect(contextFile).toBeDefined();
  });

  it("should create independent snapshots in local mode", async () => {
    const firstMode = new LocalMode();

    // Create first snapshot
    await createIncrementalSnapshot(firstMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Get first metadata file
    const firstMetadataFile = findWrittenFile(/\/_meta\/snapshot\.json$/);
    expect(firstMetadataFile).toBeDefined();
    const firstMetadata = JSON.parse(firstMetadataFile!.content);

    // Clear mocks to track second snapshot separately
    const firstWriteCount = mockWriteFile.mock.calls.length;

    // Create a new LocalMode instance
    const secondMode = new LocalMode();

    // Run another snapshot
    await createIncrementalSnapshot(secondMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
      showProgress: true,
    });

    // Should have written more files for the second snapshot
    expect(mockWriteFile.mock.calls.length).toBeGreaterThan(firstWriteCount);

    // Find the second metadata file (it will be in a different directory)
    const allMetadataFiles = getWrittenFiles().filter((f) =>
      f.path.endsWith("/_meta/snapshot.json")
    );
    expect(allMetadataFiles.length).toBe(2);

    // Verify both snapshots have valid metadata
    for (const file of allMetadataFiles) {
      const metadata = JSON.parse(file.content);
      expect(metadata.phoenix_url).toBe("http://localhost:6006");
      expect(metadata.created_at).toBeDefined();
    }
  });

  it("should handle missing previous snapshot gracefully", async () => {
    const localMode = new LocalMode();

    // Mock exec to return failure (no existing snapshot metadata)
    mockExecAsyncFn = async () => {
      const error = Object.assign(new Error("cat: file not found"), {
        code: 1,
        stdout: "",
        stderr: "cat: file not found",
      });
      throw error;
    };

    // Run incremental update without any existing snapshot
    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 50,
      showProgress: true,
    });

    // Should create a full snapshot
    const metadataFile = findWrittenFile(/\/_meta\/snapshot\.json$/);
    expect(metadataFile).toBeDefined();

    const metadata = JSON.parse(metadataFile!.content);
    expect(metadata.phoenix_url).toBe("http://localhost:6006");
  });

  it("should handle concurrent snapshot operations", async () => {
    // Create two LocalMode instances
    const mode1 = new LocalMode();
    const mode2 = new LocalMode();

    // Run two snapshots concurrently
    const promise1 = createIncrementalSnapshot(mode1, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    const promise2 = createIncrementalSnapshot(mode2, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Wait for both to complete
    await Promise.all([promise1, promise2]);

    // Both should succeed and create separate snapshot directories
    // Check that mkdir was called with two different directories
    const mkdirCalls = mockMkdir.mock.calls.map((call) => call[0] as string);
    const snapshotDirs = new Set(
      mkdirCalls
        .filter((path) =>
          path.startsWith("/mock/home/.phoenix-insight/snapshots/")
        )
        .map((path) => {
          // Extract the timestamp-random part
          const match = path.match(
            /\/mock\/home\/\.phoenix-insight\/snapshots\/(\d+-\w+)\//
          );
          return match ? match[1] : null;
        })
        .filter(Boolean)
    );

    // Should have at least 2 unique snapshot directories
    expect(snapshotDirs.size).toBeGreaterThanOrEqual(2);

    // Verify both snapshots have metadata
    const allMetadataFiles = getWrittenFiles().filter((f) =>
      f.path.endsWith("/_meta/snapshot.json")
    );
    expect(allMetadataFiles.length).toBe(2);

    // Verify both are valid
    for (const file of allMetadataFiles) {
      const metadata = JSON.parse(file.content);
      expect(metadata.phoenix_url).toBe("http://localhost:6006");
    }
  });

  it("should use timestamp and random string for unique snapshot directories", async () => {
    const localMode = new LocalMode();

    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    // Verify the directory pattern includes timestamp and random suffix
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/mock\/home\/\.phoenix-insight\/snapshots\/\d+-[a-z0-9]+\/phoenix$/
      ),
      { recursive: true }
    );
  });

  it("should write metadata with correct structure", async () => {
    const localMode = new LocalMode();

    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 200,
    });

    const metadataFile = findWrittenFile(/\/_meta\/snapshot\.json$/);
    expect(metadataFile).toBeDefined();

    const metadata = JSON.parse(metadataFile!.content);

    // Verify all required fields
    expect(metadata).toHaveProperty("created_at");
    expect(metadata).toHaveProperty("phoenix_url", "http://localhost:6006");
    expect(metadata).toHaveProperty("cursors");
    expect(metadata).toHaveProperty("limits");
    expect(metadata.limits.spans_per_project).toBe(200);

    // Verify cursors structure
    expect(metadata.cursors).toHaveProperty("datasets");
    expect(metadata.cursors).toHaveProperty("experiments");
    expect(metadata.cursors).toHaveProperty("prompts");
  });

  it("should write all expected files", async () => {
    const localMode = new LocalMode();

    await createIncrementalSnapshot(localMode, {
      baseURL: "http://localhost:6006",
      spansPerProject: 100,
    });

    const writtenPaths = getWrittenFiles().map((f) => f.path);

    // Verify key files were written (checking path suffixes)
    expect(writtenPaths.some((p) => p.includes("projects/index.jsonl"))).toBe(
      true
    );
    expect(writtenPaths.some((p) => p.includes("datasets/index.jsonl"))).toBe(
      true
    );
    expect(
      writtenPaths.some((p) => p.includes("experiments/index.jsonl"))
    ).toBe(true);
    expect(writtenPaths.some((p) => p.includes("prompts/index.jsonl"))).toBe(
      true
    );
    expect(writtenPaths.some((p) => p.includes("_context.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.includes("_meta/snapshot.json"))).toBe(
      true
    );
  });
});
