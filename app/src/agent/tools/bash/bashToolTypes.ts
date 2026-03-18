export interface BashToolCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BashToolRuntime {
  executeCommand: (command: string) => Promise<BashToolCommandResult>;
}
