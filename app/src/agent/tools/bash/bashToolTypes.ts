export interface BashToolCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BashToolRuntime {
  executeCommand: (
    command: string,
    options?: {
      signal?: AbortSignal;
    }
  ) => Promise<BashToolCommandResult>;
}
