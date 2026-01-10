import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("phoenix-insight prune command", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  const testHomeDir = path.join(os.tmpdir(), `phoenix-test-home-${Date.now()}`);
  const testSnapshotDir = path.join(testHomeDir, ".phoenix-insight");

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create a test home directory with snapshots
    await fs.mkdir(
      path.join(testSnapshotDir, "snapshots", "test-snapshot", "phoenix"),
      { recursive: true }
    );
    await fs.writeFile(
      path.join(
        testSnapshotDir,
        "snapshots",
        "test-snapshot",
        "phoenix",
        "test.json"
      ),
      JSON.stringify({ test: true })
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testHomeDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should show prune command in help", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} --help`);
    expect(stdout).toContain("prune");
    expect(stdout).toContain("Delete the local snapshot directory");
  });

  it("should show help for prune command", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} prune --help`);
    expect(stdout).toContain(
      "Delete the local snapshot directory (~/.phoenix-insight/)"
    );
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain(
      "Show what would be deleted without actually deleting"
    );
  });

  it("should handle when no snapshot directory exists", async () => {
    // Use a directory that doesn't exist
    const nonExistentHome = path.join(
      os.tmpdir(),
      `phoenix-test-empty-${Date.now()}`
    );
    const { stdout } = await execAsync(
      `HOME=${nonExistentHome} tsx ${cliPath} prune`
    );
    expect(stdout).toContain(
      "No local snapshot directory found. Nothing to prune."
    );
  });

  it("should perform dry run without deleting", async () => {
    const { stdout } = await execAsync(
      `HOME=${testHomeDir} tsx ${cliPath} prune --dry-run`
    );
    expect(stdout).toContain("Dry run mode - would delete:");
    expect(stdout).toContain(testSnapshotDir);
    expect(stdout).toContain("Contains 1 snapshot(s)");

    // Verify directory still exists
    const stats = await fs.stat(testSnapshotDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should cancel when user says no", async () => {
    // Use echo to simulate user input "no"
    const { stdout } = await execAsync(
      `echo "no" | HOME=${testHomeDir} tsx ${cliPath} prune`
    );
    expect(stdout).toContain("This will delete all local snapshots at:");
    expect(stdout).toContain(testSnapshotDir);
    expect(stdout).toContain("Are you sure? (yes/no):");
    expect(stdout).toContain("Prune cancelled.");

    // Verify directory still exists
    const stats = await fs.stat(testSnapshotDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should delete directory when user confirms with yes", async () => {
    // Use echo to simulate user input "yes"
    const { stdout } = await execAsync(
      `echo "yes" | HOME=${testHomeDir} tsx ${cliPath} prune`
    );
    expect(stdout).toContain("This will delete all local snapshots at:");
    expect(stdout).toContain(testSnapshotDir);
    expect(stdout).toContain("Are you sure? (yes/no):");
    expect(stdout).toContain("Local snapshot directory deleted successfully!");

    // Verify directory no longer exists
    await expect(fs.stat(testSnapshotDir)).rejects.toThrow();
  });

  it("should accept 'y' as confirmation", async () => {
    // Use echo to simulate user input "y"
    const { stdout } = await execAsync(
      `echo "y" | HOME=${testHomeDir} tsx ${cliPath} prune`
    );
    expect(stdout).toContain("Local snapshot directory deleted successfully!");

    // Verify directory no longer exists
    await expect(fs.stat(testSnapshotDir)).rejects.toThrow();
  });

  it("should handle errors gracefully", async () => {
    // Create a directory that can't be deleted (by making a file inside unwritable)
    const lockedFile = path.join(testSnapshotDir, "snapshots", "locked.txt");
    await fs.writeFile(lockedFile, "locked content");
    await fs.chmod(lockedFile, 0o444); // Read-only
    await fs.chmod(path.dirname(lockedFile), 0o555); // Read-only directory

    try {
      const result = await execAsync(
        `echo "yes" | HOME=${testHomeDir} tsx ${cliPath} prune`
      ).catch((e) => e);
      expect(result.stdout + result.stderr).toContain(
        "Error pruning snapshots:"
      );
    } finally {
      // Restore permissions for cleanup
      await fs.chmod(path.dirname(lockedFile), 0o755).catch(() => {});
      await fs.chmod(lockedFile, 0o644).catch(() => {});
    }
  });
});
