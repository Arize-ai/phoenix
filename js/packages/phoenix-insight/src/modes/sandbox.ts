import type { ExecutionMode } from "./types.js";
import { tool } from "ai";
import { z } from "zod";

/**
 * Sandbox execution mode using just-bash for isolated execution
 * - In-memory filesystem
 * - Simulated bash commands
 * - No disk or network access
 */
export class SandboxMode implements ExecutionMode {
  private bash: any; // Will be typed as Bash from just-bash
  private initialized = false;
  private bashToolPromise: Promise<any> | null = null;

  constructor() {
    // We'll initialize in the init method since we need async imports
  }

  private async init() {
    if (this.initialized) return;

    try {
      // Dynamic imports for ESM modules
      const { Bash } = await import("just-bash");

      // Initialize just-bash with /phoenix as the working directory
      this.bash = new Bash({ cwd: "/phoenix" });

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize sandbox mode: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.init();

    try {
      // Ensure the path starts with /phoenix
      const fullPath = path.startsWith("/phoenix")
        ? path
        : `/phoenix${path.startsWith("/") ? "" : "/"}${path}`;

      // Create parent directories if they don't exist
      const dirname = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirname) {
        await this.bash.exec(`mkdir -p ${dirname}`);
      }

      // Write the file using just-bash's filesystem
      // We'll use the InMemoryFs directly for better performance
      this.bash.fs.writeFileSync(fullPath, content);
    } catch (error) {
      throw new Error(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exec(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    await this.init();

    try {
      const result = await this.bash.exec(command);

      // just-bash returns a different structure, so we need to normalize it
      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode || 0,
      };
    } catch (error) {
      // If the command fails, just-bash throws an error
      // Extract what we can from the error
      if (error && typeof error === "object" && "exitCode" in error) {
        return {
          stdout: (error as any).stdout || "",
          stderr: (error as any).stderr || error.toString(),
          exitCode: (error as any).exitCode || 1,
        };
      }

      // Fallback for unexpected errors
      return {
        stdout: "",
        stderr: error?.toString() || "Unknown error",
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
    await this.init();

    // Create a bash tool compatible with the AI SDK
    // Similar to local mode, we'll create it directly using the tool function
    return tool({
      description: "Execute bash commands in the sandbox filesystem",
      inputSchema: z.object({
        command: z.string().describe("The bash command to execute"),
      }),
      execute: async ({ command }) => {
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
    });
  }

  async cleanup(): Promise<void> {
    // No-op for in-memory mode - garbage collection will handle cleanup
    // We could optionally clear the filesystem here if needed
  }
}
