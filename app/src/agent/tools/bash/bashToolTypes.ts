export interface BashToolCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BashToolRuntime {
  cwd: string;
  executeCommand: (command: string) => Promise<BashToolCommandResult>;
}
