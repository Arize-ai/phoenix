/**
 * Common interface for execution modes (sandbox vs local)
 */
export interface ExecutionMode {
  /**
   * Write Phoenix data to the filesystem
   * @param path - The file path relative to the Phoenix root
   * @param content - The content to write
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Execute a bash command and return output
   * @param command - The bash command to execute
   * @returns The command output with stdout, stderr, and exit code
   */
  exec(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /**
   * Get the bash tool for the AI SDK agent
   * @returns A tool that can be used by the AI SDK
   */
  getBashTool(): any; // We'll use 'any' for now since we don't have the Tool type from AI SDK yet

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}
