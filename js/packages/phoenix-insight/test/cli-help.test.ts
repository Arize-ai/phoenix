import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import * as path from "node:path";

// TODO: we need to avoid invoking the CLI directly. It makes networking calls and we don't want to do that in tests.
describe.skip("CLI Help and Interactive Mode", () => {
  let mockExit: any;

  beforeEach(() => {
    // Mock process.exit to prevent test runner from exiting
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it("should show help when 'help' command is used", async () => {
    const cliPath = path.join(__dirname, "../src/cli.ts");

    const result = await new Promise<{ stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn("tsx", [cliPath, "help"], {
          env: { ...process.env, NODE_ENV: "test" },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", () => {
          resolve({ stdout, stderr });
        });
      }
    );

    // Check that help output contains expected content
    expect(result.stdout).toContain("phoenix-insight");
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("Options:");
    expect(result.stdout).toContain("Commands:");
    expect(result.stdout).toContain("Examples:");
  });

  it("should start interactive mode when no arguments are provided", async () => {
    const cliPath = path.join(__dirname, "../src/cli.ts");

    const child = spawn("tsx", [cliPath], {
      env: { ...process.env, NODE_ENV: "test" },
    });

    let stdout = "";

    // Set a timeout to kill the process after checking output
    const timeout = setTimeout(() => {
      child.kill();
    }, 1000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();

      // Kill the process once we see the interactive mode prompt
      if (stdout.includes("Phoenix Insight Interactive Mode")) {
        clearTimeout(timeout);
        child.kill();
      }
    });

    await new Promise<void>((resolve) => {
      child.on("close", () => {
        resolve();
      });
    });

    // Check that interactive mode started
    expect(stdout).toContain("Phoenix Insight Interactive Mode");
    expect(stdout).toContain("Type your queries below");
  });

  it("should handle 'help' command in interactive mode", async () => {
    const cliPath = path.join(__dirname, "../src/cli.ts");

    const child = spawn("tsx", [cliPath], {
      env: { ...process.env, NODE_ENV: "test" },
    });

    let stdout = "";
    let inputSent = false;

    child.stdout.on("data", (data) => {
      stdout += data.toString();

      // Send 'help' command once interactive mode is ready
      if (stdout.includes("phoenix>") && !inputSent) {
        inputSent = true;
        child.stdin.write("help\n");

        // Exit after a short delay to capture help output
        setTimeout(() => {
          child.stdin.write("exit\n");
        }, 500);
      }
    });

    await new Promise<void>((resolve) => {
      child.on("close", () => {
        resolve();
      });
    });

    // Check that help was displayed in interactive mode
    expect(stdout).toContain("Interactive Mode Commands:");
    expect(stdout).toContain("help              - Show this help message");
    expect(stdout).toContain("exit, quit        - Exit interactive mode");
    expect(stdout).toContain("px-fetch-more     - Fetch additional data");
  });
});
