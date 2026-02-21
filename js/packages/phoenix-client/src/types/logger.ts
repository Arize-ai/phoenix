export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  log: (message: string) => void;
  debug: (message: string) => void;
  table: (data: unknown) => void;
};
