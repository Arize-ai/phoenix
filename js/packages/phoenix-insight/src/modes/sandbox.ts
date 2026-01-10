import { ExecutionMode } from "./types.js";

/**
 * Sandbox execution mode using just-bash for isolated execution
 * - In-memory filesystem
 * - Simulated bash commands
 * - No disk or network access
 */
export class SandboxMode implements ExecutionMode {
  private bash: any; // Will be typed as Bash from just-bash
  private createBashToolFn: any; // Will be the createBashTool function from bash-tool
  private initialized = false;

  constructor() {
    // We'll initialize in the init method since we need async imports
  }

  private async init() {
    if (this.initialized) return;

    // Dynamic imports for ESM modules
    const { Bash } = await import("just-bash");
    const { createBashTool } = await import("bash-tool");

    this.createBashToolFn = createBashTool;
    // Initialize just-bash with /phoenix as the working directory
    this.bash = new Bash({ cwd: "/phoenix" });

    this.initialized = true;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.init();

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
    await this.init();

    // Use the bash-tool package to create a tool for the AI SDK
    // Pass the just-bash instance as the sandbox option
    // createBashTool returns a Promise that resolves to the tool
    return await this.createBashToolFn({ sandbox: this.bash });
  }

  async cleanup(): Promise<void> {
    // No-op for in-memory mode - garbage collection will handle cleanup
    // We could optionally clear the filesystem here if needed
  }
}
