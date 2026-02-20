export type OutputMode = "quiet" | "default" | "verbose";

export type LoggerOptions = {
  outputMode?: OutputMode;
  outputStream?: NodeJS.WritableStream;
  errorStream?: NodeJS.WritableStream;
  noProgress?: boolean;
};
