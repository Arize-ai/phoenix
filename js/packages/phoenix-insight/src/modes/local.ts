import { ExecutionMode } from "./types.js";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const execAsync = promisify(execCallback);

/**
 * Local execution mode using real bash and persistent filesystem
 * - Real bash execution via child_process
 * - Persistent storage in ~/.phoenix-insight/
 * - Full system access
 */
export class LocalMode implements ExecutionMode {
  private workDir: string;
  private toolCreated = false;
  private bashToolPromise: Promise<any> | null = null;

  constructor() {
    // Create a timestamped directory for this snapshot
    const timestamp = Date.now().toString();
    this.workDir = path.join(
      os.homedir(),
      ".phoenix-insight",
      "snapshots",
      timestamp,
      "phoenix"
    );
  }

  /**
   * Initialize the working directory
   */
  private async init() {
    // Create the directory structure if it doesn't exist
    await fs.mkdir(this.workDir, { recursive: true });
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await this.init();

    // Ensure the path is relative to phoenix root
    const cleanPath = filePath.startsWith("/phoenix")
      ? filePath.substring(8) // Remove /phoenix prefix
      : filePath.startsWith("/")
        ? filePath.substring(1) // Remove leading slash
        : filePath;

    const fullPath = path.join(this.workDir, cleanPath);

    // Create parent directories if they don't exist
    const dirname = path.dirname(fullPath);
    await fs.mkdir(dirname, { recursive: true });

    // Write the file
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async exec(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    await this.init();

    try {
      // Execute the command in the phoenix directory
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workDir,
        shell: "/bin/bash",
        encoding: "utf-8",
      });

      return {
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: 0,
      };
    } catch (error: any) {
      // Handle command execution errors
      if (error.code !== undefined) {
        return {
          stdout: error.stdout || "",
          stderr: error.stderr || error.message || "Command failed",
          exitCode: error.code || 1,
        };
      }

      // Handle other errors
      return {
        stdout: "",
        stderr: error.message || "Unknown error",
        exitCode: 1,
      };
    }
  }

  async getBashTool(): Promise<any> {
    // Only create the tool once and cache it
    if (!this.bashToolPromise) {
      this.bashToolPromise = this.createBashTool();
    }
    return this.bashToolPromise;
  }

  private async createBashTool(): Promise<any> {
    // We can't use bash-tool directly for local mode since it's designed for just-bash
    // Instead, we'll return an object that mimics the bash-tool structure
    // This allows the agent to use it the same way

    // Return a mock bash tool that executes real bash commands
    return {
      description: "Execute bash commands in the local filesystem",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
        },
        required: ["command"],
      },
      execute: async ({ command }: { command: string }) => {
        const result = await this.exec(command);

        // Return result in a format similar to bash-tool
        if (result.exitCode !== 0) {
          // Include error details in the response
          return {
            success: false,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            error: `Command failed with exit code ${result.exitCode}`,
          };
        }

        return {
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      },
    };
  }

  async cleanup(): Promise<void> {
    // Optional: Clean up old snapshots
    // For now, we'll keep all snapshots for user reference
    // Users can manually clean ~/.phoenix-insight/ if needed
    // We could implement logic to:
    // 1. Keep only the last N snapshots
    // 2. Delete snapshots older than X days
    // 3. Provide a separate cleanup command
    // For this implementation, we do nothing
  }
}
