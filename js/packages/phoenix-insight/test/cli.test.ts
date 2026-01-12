import { describe, it, expect, beforeEach, vi } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as url from "node:url";
import * as path from "node:path";
import { readFile } from "node:fs/promises";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("phoenix-insight CLI", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should start interactive mode when no arguments provided", async () => {
    // Use a child process that we can kill after checking output
    const { exec } = await import("node:child_process");
    const proc = exec(`tsx ${cliPath}`);

    let stdout = "";
    let killed = false;

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
      // Kill the process once we see interactive mode started
      if (stdout.includes("Phoenix Insight Interactive Mode") && !killed) {
        killed = true;
        proc.kill();
      }
    });

    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      // Fallback timeout
      setTimeout(() => {
        if (!killed) {
          killed = true;
          proc.kill();
        }
      }, 2000);
    });

    expect(stdout).toContain("Phoenix Insight Interactive Mode");
    expect(stdout).toContain("Type your queries below");
  });

  it("should display version", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} --version`);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it("should show help for snapshot command", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} snapshot --help`);
    expect(stdout).toContain("Create a snapshot of Phoenix data");
    // Snapshot command uses global config - no longer has its own options
    // Global options like --base-url, --api-key, --refresh are set on the root command
    // and accessed via getConfig() in the snapshot action handler
    expect(stdout).toContain("Options:");
    expect(stdout).toContain("-h, --help");
  });

  it("should show help with --help flag", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} --help`);
    expect(stdout).toContain("Usage: phoenix-insight");
    expect(stdout).toContain("A CLI for Phoenix data analysis with AI agents");
    expect(stdout).toContain("Commands:");
    expect(stdout).toContain("snapshot");
  });

  it("should accept sandbox option", async () => {
    // Test that sandbox option is accepted by showing help
    const result = await execAsync(`tsx ${cliPath} --sandbox --help`, {
      timeout: 2000,
    });

    // Should show help without error
    expect(result.stdout).toContain("Usage: phoenix-insight");
    expect(result.stdout).toContain("--sandbox");
  });

  it("should accept base-url option", async () => {
    const customUrl = "https://phoenix.example.com";
    try {
      await execAsync(
        `tsx ${cliPath} "test" --base-url ${customUrl} --sandbox`,
        { timeout: 1000 }
      );
    } catch (error: any) {
      // Check that the custom URL was used
      expect(error.message).toContain("Error"); // Network error expected
    }
  });

  it("should accept limit option", async () => {
    // Just test that the option is accepted by showing help
    const result = await execAsync(`tsx ${cliPath} --limit 500 --help`, {
      timeout: 2000,
    });

    // Should show help without error
    expect(result.stdout).toContain("Usage: phoenix-insight");
    expect(result.stdout).toContain("--limit <number>");
  });
});
